import { Injectable, Logger, Inject } from "@nestjs/common";
import { MessagesService } from "./messages.service";
import { ConversationsService } from "./conversations.service";
import { LLM_CLIENT } from "../common/services/llm/llm.client";
import type { LlmClient } from "../common/services/llm/llm.client";
import { FinalContextComposer } from "./context-builders/final-context-composer.service";
import { Message } from "../entities/message.entity";
import { Conversation } from "../entities/conversation.entity";

export interface ChatResponse {
  message: Message;
  conversation: Conversation;
  usage?: {
    input: number;
    output: number;
    total: number;
  };
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly finalContextComposer: FinalContextComposer,
    @Inject(LLM_CLIENT)
    private readonly llmClient: LlmClient,
  ) {}

  /**
   * Send a chat message and get LLM response
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    userMessage: string,
  ): Promise<ChatResponse> {
    this.logger.log({
      action: "chat.send_message.start",
      userId,
      conversationId,
      messageLength: userMessage.length,
    });

    // Get conversation to access planId
    const conversation = await this.conversationsService.findOne(
      conversationId,
      userId,
    );

    // Create user message
    const userMsg = await this.messagesService.create(userId, conversationId, {
      content: userMessage,
    });

    // Build context using context builders
    let contextPrefix = "";
    try {
      const finalContext = await this.finalContextComposer.composeContext({
        planId: conversation.planId,
        conversationId,
        query: userMessage, // Use user message as query for embedding search
        includeConversation: true,
        includeEmbeddings: true,
        includePlan: true,
      });

      if (finalContext.formatted) {
        contextPrefix = finalContext.formatted + "\n\n";
        this.logger.log({
          action: "chat.context_built",
          conversationId,
          contextTokens: finalContext.tokenCount,
        });
      }
    } catch (error) {
      // Log but continue - we'll still generate a response
      this.logger.warn({
        action: "chat.context_build_failed",
        conversationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Build prompt with context
    const systemPrompt = `You are a helpful travel assistant. You help users plan their trips, find hotels, restaurants, and attractions. Use the provided context (conversation history, plan information, and relevant memories) to give personalized and helpful responses.`;

    const userPrompt = contextPrefix
      ? `${contextPrefix}User: ${userMessage}\n\nAssistant:`
      : `User: ${userMessage}\n\nAssistant:`;

    // Generate LLM response
    let assistantResponse: string;
    let usage: { input: number; output: number; total: number } | undefined;

    try {
      const result = await this.llmClient.generate(userPrompt, {
        system: systemPrompt,
        temperature: 0.7,
        maxTokens: 2000,
      });

      assistantResponse = result.text.trim();
      usage = result.usage;

      this.logger.log({
        action: "chat.llm_response_generated",
        conversationId,
        responseLength: assistantResponse.length,
        tokensUsed: usage?.total ?? 0,
      });
    } catch (error) {
      this.logger.error({
        action: "chat.llm_generation_failed",
        conversationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Fallback response
      assistantResponse =
        "I apologize, but I'm having trouble generating a response right now. Please try again.";
    }

    // Create assistant message directly with ASSISTANT role
    const assistantMsg = await this.messagesService.createAssistantMessage(
      userId,
      conversationId,
      assistantResponse,
    );

    this.logger.log({
      action: "chat.send_message.complete",
      userId,
      conversationId,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsg.id,
    });

    return {
      message: assistantMsg,
      conversation,
      usage,
    };
  }
}
