import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { EmbeddingsService } from "../../features/embeddings/embeddings.service";
import {
  EmbeddingContext,
  EmbeddingContextOptions,
  ContextBuilderError,
} from "../../core/types/context-builder.type";
import { estimateTokens, trimToTokenLimit } from "../../core/utils/token.util";

@Injectable()
export class EmbeddingContextBuilder {
  private readonly logger = new Logger(EmbeddingContextBuilder.name);

  constructor(
    @Inject(forwardRef(() => EmbeddingsService))
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  /**
   * Build embedding context from semantic search
   */
  async buildEmbeddingContext(
    planId: string,
    query: string | undefined,
    options: EmbeddingContextOptions = {},
  ): Promise<EmbeddingContext | null> {
    // If no query provided, skip embedding search
    if (!query || query.trim().length === 0) {
      this.logger.log({
        action: "embedding_context.build.skipped",
        planId,
        reason: "no_query",
      });
      return null;
    }

    const topK = options.topK ?? 10;
    const threshold = options.threshold ?? 0.5;
    const maxTokens = options.maxTokens;

    this.logger.log({
      action: "embedding_context.build.start",
      planId,
      query: query.substring(0, 100), // Log first 100 chars
      topK,
      threshold,
    });

    try {
      // Search for relevant embeddings
      const searchResults = await this.searchRelevantEmbeddings(
        planId,
        query,
        topK,
        threshold,
      );

      if (searchResults.length === 0) {
        return {
          embeddings: [],
          formatted: "",
          tokenCount: 0,
          query,
        };
      }

      // Format embeddings
      let formatted = this.formatEmbeddingBlock(searchResults);
      let tokenCount = estimateTokens(formatted);

      // Trim if over token limit
      if (maxTokens && tokenCount > maxTokens) {
        // Trim each embedding content to fit
        const trimmedResults = searchResults.map((result) => {
          const contentTokens = estimateTokens(result.content);
          const targetTokens = Math.floor(maxTokens / searchResults.length);
          if (contentTokens > targetTokens) {
            return {
              ...result,
              content: trimToTokenLimit(result.content, targetTokens),
            };
          }
          return result;
        });

        formatted = this.formatEmbeddingBlock(trimmedResults);
        tokenCount = estimateTokens(formatted);

        // If still over, reduce number of embeddings
        if (tokenCount > maxTokens) {
          const reducedCount = Math.max(
            1,
            Math.floor((searchResults.length * maxTokens) / tokenCount),
          );
          const reducedResults = trimmedResults.slice(0, reducedCount);
          formatted = this.formatEmbeddingBlock(reducedResults);
          tokenCount = estimateTokens(formatted);
        }
      }

      this.logger.log({
        action: "embedding_context.build.complete",
        planId,
        embeddingCount: searchResults.length,
        tokenCount,
      });

      return {
        embeddings: searchResults,
        formatted,
        tokenCount,
        query,
      };
    } catch (error) {
      this.logger.error({
        action: "embedding_context.build.error",
        planId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw new ContextBuilderError(
        `Failed to build embedding context: ${error instanceof Error ? error.message : "Unknown error"}`,
        "EMBEDDING_CONTEXT_BUILD_FAILED",
        { planId, query },
      );
    }
  }

  /**
   * Search for relevant embeddings using semantic search
   */
  private async searchRelevantEmbeddings(
    planId: string,
    query: string,
    topK: number,
    threshold: number,
  ) {
    // We need userId for the search, but we don't have it here
    // We'll need to modify EmbeddingsService to have an internal method
    // For now, we'll use a workaround - we need to get userId from plan
    // Actually, let's add an internal method to EmbeddingsService

    // Use internal method that doesn't require userId (for context building)
    const results = await this.embeddingsService.searchSimilarInternal(
      planId,
      query,
      {
        topK,
        threshold,
      },
    );

    return results.map((result) => ({
      id: result.id,
      content: result.content,
      similarity: result.similarity,
      refType: result.refType,
      refId: result.refId,
      createdAt: result.createdAt,
    }));
  }

  /**
   * Format embedding block for LLM
   */
  private formatEmbeddingBlock(
    embeddings: Array<{
      id: string;
      content: string;
      similarity: number;
      refType: string;
      refId: string | null;
      createdAt: Date;
    }>,
  ): string {
    if (embeddings.length === 0) {
      return "";
    }

    const parts: string[] = [];
    parts.push(`## Relevant Memory (${embeddings.length} items)`);

    for (const embedding of embeddings) {
      const similarityPercent = (embedding.similarity * 100).toFixed(1);
      parts.push(
        `\n### Memory Item (${similarityPercent}% relevant, ${embedding.refType})`,
      );
      if (embedding.refId) {
        parts.push(`Reference ID: ${embedding.refId}`);
      }
      parts.push(`Content: ${embedding.content}`);
    }

    return parts.join("\n");
  }
}
