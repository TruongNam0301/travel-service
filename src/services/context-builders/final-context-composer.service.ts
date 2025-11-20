import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConversationContextBuilder } from "./conversation-context-builder.service";
import { PlanContextBuilder } from "./plan-context-builder.service";
import { EmbeddingContextBuilder } from "./embedding-context-builder.service";
import {
  FinalContext,
  FinalContextOptions,
  ContextBuilderError,
  ConversationContext,
  PlanContext,
  EmbeddingContext,
} from "../../shared/types/context-builder.type";
import {
  estimateTokens,
  calculateTokenBudget,
  trimToTokenLimit,
} from "../../shared/utils/token.util";
import { ContextBuilderConfig } from "../../config/context-builder.config";
import { CONTEXT_BUILDER_MIN_TOKENS } from "../../shared/constants/context-builder.constant";

@Injectable()
export class FinalContextComposer {
  private readonly logger = new Logger(FinalContextComposer.name);
  private readonly config: ContextBuilderConfig;

  constructor(
    private readonly conversationBuilder: ConversationContextBuilder,
    private readonly planBuilder: PlanContextBuilder,
    private readonly embeddingBuilder: EmbeddingContextBuilder,
    private readonly configService: ConfigService,
  ) {
    this.config =
      this.configService.get<ContextBuilderConfig>("contextBuilder")!;
  }

  /**
   * Compose final context from all available sources
   */
  async composeContext(options: FinalContextOptions): Promise<FinalContext> {
    const {
      planId,
      conversationId,
      query,
      maxTokens = this.config.maxTokens,
      priorities,
      includeConversation = true,
      includeEmbeddings = true,
      includePlan = true,
    } = options;

    try {
      // Calculate token budget allocation
      const budget = calculateTokenBudget(maxTokens, priorities);

      // Build contexts in parallel (where possible)
      const contextPromises: Array<
        Promise<ConversationContext | PlanContext | EmbeddingContext | null>
      > = [];

      if (includeConversation && conversationId) {
        contextPromises.push(
          this.conversationBuilder
            .buildConversationContext(conversationId, {
              maxTokens: budget.messages,
            })
            .catch((err) => {
              this.logger.warn({
                action: "final_context.conversation_failed",
                conversationId,
                error: err instanceof Error ? err.message : "Unknown error",
              });
              return null;
            }),
        );
      } else {
        contextPromises.push(Promise.resolve(null));
      }

      if (includePlan) {
        contextPromises.push(
          this.planBuilder
            .buildPlanContext(planId, {
              maxTokens: budget.plan,
            })
            .catch((err) => {
              this.logger.warn({
                action: "final_context.plan_failed",
                planId,
                error: err instanceof Error ? err.message : "Unknown error",
              });
              return null;
            }),
        );
      } else {
        contextPromises.push(Promise.resolve(null));
      }

      if (includeEmbeddings) {
        contextPromises.push(
          this.embeddingBuilder
            .buildEmbeddingContext(planId, query, {
              maxTokens: budget.embeddings,
            })
            .catch((err) => {
              this.logger.warn({
                action: "final_context.embeddings_failed",
                planId,
                error: err instanceof Error ? err.message : "Unknown error",
              });
              return null;
            }),
        );
      } else {
        contextPromises.push(Promise.resolve(null));
      }

      const [conversation, plan, embeddings] = (await Promise.all(
        contextPromises,
      )) as [
        ConversationContext | null,
        PlanContext | null,
        EmbeddingContext | null,
      ];

      // Apply token budget rules (priority: messages > embeddings > plan)
      const adjustedContexts = this.applyTokenBudget(
        {
          conversation: conversation ?? undefined,
          plan: plan ?? undefined,
          embeddings: embeddings ?? undefined,
        },
        maxTokens,
      );

      // Format final prompt
      const formatted = this.formatFinalPrompt(adjustedContexts);
      const tokenCount = estimateTokens(formatted);

      const breakdown = {
        conversation: adjustedContexts.conversation?.tokenCount || 0,
        plan: adjustedContexts.plan?.tokenCount || 0,
        embeddings: adjustedContexts.embeddings?.tokenCount || 0,
      };

      this.logger.log({
        action: "final_context.compose.complete",
        planId,
        conversationId,
        tokenCount,
        breakdown,
      });

      return {
        conversation: adjustedContexts.conversation,
        plan: adjustedContexts.plan,
        embeddings: adjustedContexts.embeddings,
        formatted,
        tokenCount,
        breakdown,
      };
    } catch (error) {
      this.logger.error({
        action: "final_context.compose.error",
        planId,
        conversationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw new ContextBuilderError(
        `Failed to compose final context: ${error instanceof Error ? error.message : "Unknown error"}`,
        "FINAL_CONTEXT_COMPOSE_FAILED",
        { planId, conversationId },
      );
    }
  }

  /**
   * Apply token budget rules with priority
   * Priority: messages > embeddings > plan
   */
  private applyTokenBudget(
    contexts: {
      conversation?: ConversationContext;
      plan?: PlanContext;
      embeddings?: EmbeddingContext;
    },
    maxTokens: number,
  ): {
    conversation?: ConversationContext;
    plan?: PlanContext;
    embeddings?: EmbeddingContext;
  } {
    let totalTokens =
      (contexts.conversation?.tokenCount || 0) +
      (contexts.plan?.tokenCount || 0) +
      (contexts.embeddings?.tokenCount || 0);

    if (totalTokens <= maxTokens) {
      return contexts;
    }

    const result = { ...contexts };
    const excess = totalTokens - maxTokens;

    // Priority 1: Keep conversation (highest priority)
    // Priority 2: Trim embeddings if needed
    if (result.embeddings && result.embeddings.tokenCount > 0) {
      const embeddingsTokens = result.embeddings.tokenCount;
      const targetEmbeddingsTokens = Math.max(
        CONTEXT_BUILDER_MIN_TOKENS.embeddings,
        embeddingsTokens - Math.floor(excess * 0.6), // Take 60% of excess from embeddings
      );

      if (targetEmbeddingsTokens < embeddingsTokens) {
        const trimmedFormatted = trimToTokenLimit(
          result.embeddings.formatted,
          targetEmbeddingsTokens,
        );
        result.embeddings = {
          ...result.embeddings,
          formatted: trimmedFormatted,
          tokenCount: estimateTokens(trimmedFormatted),
        };
        totalTokens =
          (result.conversation?.tokenCount || 0) +
          (result.plan?.tokenCount || 0) +
          (result.embeddings?.tokenCount || 0);
      }
    }

    // Priority 3: Trim plan metadata if still over
    if (totalTokens > maxTokens && result.plan && result.plan.tokenCount > 0) {
      const planTokens = result.plan.tokenCount;
      const remainingExcess = totalTokens - maxTokens;
      const targetPlanTokens = Math.max(
        CONTEXT_BUILDER_MIN_TOKENS.plan,
        planTokens - remainingExcess,
      );

      if (targetPlanTokens < planTokens) {
        const trimmedFormatted = trimToTokenLimit(
          result.plan.formatted,
          targetPlanTokens,
        );
        result.plan = {
          ...result.plan,
          formatted: trimmedFormatted,
          tokenCount: estimateTokens(trimmedFormatted),
        };
        totalTokens =
          (result.conversation?.tokenCount || 0) +
          (result.plan?.tokenCount || 0) +
          (result.embeddings?.tokenCount || 0);
      }
    }

    // Last resort: Trim conversation if still over (should be rare)
    if (totalTokens > maxTokens && result.conversation) {
      const conversationTokens = result.conversation.tokenCount;
      const remainingExcess = totalTokens - maxTokens;
      const targetConversationTokens = Math.max(
        CONTEXT_BUILDER_MIN_TOKENS.messages,
        conversationTokens - remainingExcess,
      );

      if (targetConversationTokens < conversationTokens) {
        const trimmedFormatted = trimToTokenLimit(
          result.conversation.formatted,
          targetConversationTokens,
        );
        result.conversation = {
          ...result.conversation,
          formatted: trimmedFormatted,
          tokenCount: estimateTokens(trimmedFormatted),
        };
      }
    }

    return result;
  }

  /**
   * Format final prompt from all contexts
   */
  private formatFinalPrompt(contexts: {
    conversation?: { formatted: string };
    plan?: { formatted: string };
    embeddings?: { formatted: string };
  }): string {
    const parts: string[] = [];

    // Add plan context first (foundation)
    if (contexts.plan?.formatted) {
      parts.push(contexts.plan.formatted);
    }

    // Add embeddings (relevant memory)
    if (contexts.embeddings?.formatted) {
      parts.push("\n" + contexts.embeddings.formatted);
    }

    // Add conversation (most recent context)
    if (contexts.conversation?.formatted) {
      parts.push("\n" + contexts.conversation.formatted);
    }

    return parts.join("\n\n");
  }
}
