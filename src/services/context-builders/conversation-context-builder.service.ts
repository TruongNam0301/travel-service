import { Injectable, Logger, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MessagesService } from "../messages.service";
import { LLM_CLIENT } from "../../common/services/llm/llm.client";
import type { LlmClient } from "../../common/services/llm/llm.client";
import {
  ConversationContext,
  ConversationContextOptions,
  ContextBuilderError,
} from "../../shared/types/context-builder.type";
import {
  estimateTokens,
  trimTextsToTokenLimit,
} from "../../shared/utils/token.util";
import { ContextBuilderConfig } from "../../config/context-builder.config";
import { Message, MessageRole } from "../../entities/message.entity";

@Injectable()
export class ConversationContextBuilder {
  private readonly logger = new Logger(ConversationContextBuilder.name);
  private readonly config: ContextBuilderConfig;

  constructor(
    private readonly messagesService: MessagesService,
    private readonly configService: ConfigService,
    @Inject(LLM_CLIENT)
    private readonly llmClient: LlmClient,
  ) {
    this.config =
      this.configService.get<ContextBuilderConfig>("contextBuilder")!;
  }

  /**
   * Build conversation context from recent messages
   */
  async buildConversationContext(
    conversationId: string,
    options: ConversationContextOptions = {},
  ): Promise<ConversationContext> {
    const limit = options.limit ?? this.config.messageLimit;
    const maxTokens = options.maxTokens;
    const includeSummaries = options.includeSummaries ?? true;
    const longMessageThreshold =
      options.longMessageThreshold ?? this.config.longMessageThreshold;

    this.logger.log({
      action: "conversation_context.build.start",
      conversationId,
      limit,
      maxTokens,
    });

    try {
      // Get recent messages (internal method, no ownership check needed here)
      const messages = await this.getRecentMessages(conversationId, limit * 2); // Get more than needed for trimming

      if (messages.length === 0) {
        return {
          messages: [],
          formatted: "",
          tokenCount: 0,
          truncated: false,
        };
      }

      // Process messages: summarize long ones if needed
      let processedMessages = messages;
      if (includeSummaries) {
        processedMessages = await this.processLongMessages(
          messages,
          longMessageThreshold,
        );
      }

      // Trim to token limit if specified
      let truncated = false;
      if (maxTokens) {
        const messageTexts = processedMessages.map((m) => m.content);
        const trimmedTexts = trimTextsToTokenLimit(messageTexts, maxTokens);
        truncated = trimmedTexts.length < processedMessages.length;

        // Rebuild message array with trimmed content
        processedMessages = processedMessages.slice(
          processedMessages.length - trimmedTexts.length,
        );
        for (let i = 0; i < processedMessages.length; i++) {
          if (trimmedTexts[i] !== processedMessages[i].content) {
            processedMessages[i] = {
              ...processedMessages[i],
              content: trimmedTexts[i],
            };
          }
        }
      } else {
        // Still limit to configured limit
        processedMessages = processedMessages.slice(-limit);
      }

      // Format messages for LLM
      const formatted = this.formatMessages(processedMessages);
      const tokenCount = estimateTokens(formatted);

      this.logger.log({
        action: "conversation_context.build.complete",
        conversationId,
        messageCount: processedMessages.length,
        tokenCount,
        truncated,
      });

      return {
        messages: processedMessages,
        formatted,
        tokenCount,
        truncated,
      };
    } catch (error) {
      this.logger.error({
        action: "conversation_context.build.error",
        conversationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw new ContextBuilderError(
        `Failed to build conversation context: ${error instanceof Error ? error.message : "Unknown error"}`,
        "CONVERSATION_CONTEXT_BUILD_FAILED",
        { conversationId },
      );
    }
  }

  /**
   * Get recent messages for a conversation (internal method)
   */
  private async getRecentMessages(
    conversationId: string,
    limit: number,
  ): Promise<Message[]> {
    try {
      const result: Message[] =
        await this.messagesService.getRecentMessagesInternal(
          conversationId,
          limit,
        );
      return result;
    } catch (error) {
      this.logger.warn({
        action: "conversation_context.get_messages_failed",
        conversationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [] as Message[];
    }
  }

  /**
   * Process long messages: summarize if they exceed threshold
   */
  private async processLongMessages(
    messages: Message[],
    threshold: number,
  ): Promise<Message[]> {
    const processed: Message[] = [];

    for (const message of messages) {
      const tokens = estimateTokens(message.content);
      if (tokens > threshold) {
        try {
          const summary = await this.summarizeLongMessage(
            message.content,
            threshold,
          );
          processed.push({
            ...message,
            content: `[Summarized from ${tokens} tokens] ${summary}`,
          });
        } catch (error) {
          // If summarization fails, use trimmed version
          this.logger.warn({
            action: "conversation_context.summarize_failed",
            messageId: message.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          processed.push(message); // Keep original if summarization fails
        }
      } else {
        processed.push(message);
      }
    }

    return processed;
  }

  /**
   * Summarize a long message using LLM
   */
  private async summarizeLongMessage(
    content: string,
    maxTokens: number,
  ): Promise<string> {
    const prompt = `Summarize the following message concisely while preserving key information. The summary should be no more than ${Math.floor(maxTokens * 0.8)} tokens.

Message to summarize:
${content}

Provide a concise summary:`;

    try {
      const result = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: Math.floor(maxTokens * 0.8),
      });

      return result.text.trim();
    } catch (error) {
      this.logger.error({
        action: "conversation_context.summarize_llm_error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Format messages for LLM context
   */
  private formatMessages(messages: Message[]): string {
    if (messages.length === 0) {
      return "";
    }

    const formatted = messages
      .map((msg) => {
        const role = msg.role === MessageRole.USER ? "User" : "Assistant";
        return `${role}: ${msg.content}`;
      })
      .join("\n\n");

    return `## Conversation History\n\n${formatted}`;
  }
}
