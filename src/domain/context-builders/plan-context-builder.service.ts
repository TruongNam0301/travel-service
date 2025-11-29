import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import { Job } from "../../features/jobs/entities/job.entity";
import {
  ContextBuilderError,
  PlanContext,
  PlanContextOptions,
} from "../../core/types/context-builder.type";
import { estimateTokens } from "../../core/utils/token.util";
import { JobsService } from "../../features/jobs/jobs.service";
import { MemoryCompressionService } from "../memory-compression/memory-compression.service";
import { PlansService } from "../../features/plans/plans.service";

@Injectable()
export class PlanContextBuilder {
  private readonly logger = new Logger(PlanContextBuilder.name);

  constructor(
    @Inject(forwardRef(() => PlansService))
    private readonly plansService: PlansService,
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
    @Inject(forwardRef(() => MemoryCompressionService))
    private readonly memoryCompressionService: MemoryCompressionService,
  ) {}

  /**
   * Build plan context with metadata, jobs, and embeddings summary
   */
  async buildPlanContext(
    planId: string,
    options: PlanContextOptions = {},
  ): Promise<PlanContext> {
    const includeMetadata = options.includeMetadata ?? true;
    const includeJobs = options.includeJobs ?? true;
    const jobLimit = options.jobLimit ?? 10;
    const includeEmbeddingsSummary = options.includeEmbeddingsSummary ?? true;
    const maxTokens = options.maxTokens;

    try {
      const plan = await this.plansService.findOneById(planId);
      if (!plan) {
        throw new ContextBuilderError(
          `Plan not found: ${planId}`,
          "PLAN_NOT_FOUND",
          { planId },
        );
      }

      // Fetch data in parallel
      const [recentJobs, embeddingsSummary] = await Promise.all([
        includeJobs
          ? this.getRecentJobs(planId, jobLimit).catch(() => {
              return [];
            })
          : Promise.resolve([]),
        includeEmbeddingsSummary
          ? this.getEmbeddingsSummary(planId).catch(() => {
              return undefined;
            })
          : Promise.resolve(undefined),
      ]);

      // Format context
      const formatted = this.formatPlanContext(
        plan,
        includeMetadata ? plan.metadata : undefined,
        includeJobs ? recentJobs : undefined,
        includeEmbeddingsSummary ? embeddingsSummary : undefined,
      );

      let finalFormatted = formatted;
      let tokenCount = estimateTokens(formatted);

      // Trim if over token limit
      if (maxTokens && tokenCount > maxTokens) {
        // Trim embeddings summary first, then jobs, then metadata
        if (includeEmbeddingsSummary && embeddingsSummary) {
          const summaryText = this.formatEmbeddingsSummary(embeddingsSummary);
          const summaryTokens = estimateTokens(summaryText);
          if (summaryTokens > maxTokens * 0.3) {
            // Remove embeddings summary if it's too large
            finalFormatted = this.formatPlanContext(
              plan,
              includeMetadata ? plan.metadata : undefined,
              includeJobs ? recentJobs : undefined,
              undefined,
            );
            tokenCount = estimateTokens(finalFormatted);
          }
        }

        if (tokenCount > maxTokens && includeJobs && recentJobs.length > 0) {
          // Reduce job count
          const reducedJobs = recentJobs.slice(
            0,
            Math.max(1, Math.floor(jobLimit / 2)),
          );
          finalFormatted = this.formatPlanContext(
            plan,
            includeMetadata ? plan.metadata : undefined,
            reducedJobs,
            includeEmbeddingsSummary ? embeddingsSummary : undefined,
          );
          tokenCount = estimateTokens(finalFormatted);
        }

        if (tokenCount > maxTokens && includeMetadata && plan.metadata) {
          // Remove metadata if still over
          finalFormatted = this.formatPlanContext(
            plan,
            undefined,
            includeJobs ? recentJobs : undefined,
            includeEmbeddingsSummary ? embeddingsSummary : undefined,
          );
          tokenCount = estimateTokens(finalFormatted);
        }
      }

      this.logger.log({
        action: "plan_context.build.complete",
        planId,
        tokenCount,
        hasMetadata: !!plan.metadata,
        jobCount: recentJobs.length,
        hasEmbeddingsSummary: !!embeddingsSummary,
      });

      return {
        plan,
        metadata: includeMetadata ? plan.metadata : undefined,
        recentJobs: includeJobs ? recentJobs : undefined,
        embeddingsSummary: includeEmbeddingsSummary
          ? embeddingsSummary
          : undefined,
        formatted: finalFormatted,
        tokenCount,
      };
    } catch (error) {
      this.logger.error({
        action: "plan_context.build.error",
        planId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      if (error instanceof ContextBuilderError) {
        throw error;
      }

      throw new ContextBuilderError(
        `Failed to build plan context: ${error instanceof Error ? error.message : "Unknown error"}`,
        "PLAN_CONTEXT_BUILD_FAILED",
        { planId },
      );
    }
  }

  /**
   * Get recent completed jobs for a plan
   */
  private async getRecentJobs(planId: string, limit: number): Promise<Job[]> {
    return await this.jobsService.getRecentJobsInternal(planId, limit);
  }

  /**
   * Get embeddings summary for a plan
   */
  private async getEmbeddingsSummary(planId: string) {
    const stats = await this.memoryCompressionService.getMemoryStats(planId);

    return {
      total: stats.totalEmbeddings,
      active: stats.activeEmbeddings,
      archived: stats.archivedEmbeddings,
      lastCompression: stats.lastCompression
        ? {
            mode: stats.lastCompression.mode,
            ratio: stats.lastCompression.compressionRatio,
            timestamp: stats.lastCompression.timestamp,
          }
        : undefined,
    };
  }

  /**
   * Format plan context for LLM
   */
  private formatPlanContext(
    plan: { id: string; title: string; metadata?: Record<string, any> },
    metadata?: Record<string, any>,
    jobs?: Job[],
    embeddingsSummary?: {
      total: number;
      active: number;
      archived: number;
      lastCompression?: {
        mode: string;
        ratio: number;
        timestamp: Date;
      };
    },
  ): string {
    const parts: string[] = [];

    parts.push(`## Plan: ${plan.title}`);
    parts.push(`Plan ID: ${plan.id}`);

    if (metadata && Object.keys(metadata).length > 0) {
      parts.push(`\n### Plan Metadata`);
      parts.push(JSON.stringify(metadata, null, 2));
    }

    if (jobs && jobs.length > 0) {
      parts.push(`\n### Recent Jobs (${jobs.length})`);
      for (const job of jobs) {
        const result = job.result as Record<string, unknown> | undefined;
        const summary =
          (result?.summary as string | undefined) ||
          (result?.title as string | undefined) ||
          "No summary available";
        parts.push(`- ${job.type} (${job.state}): ${summary}`);
      }
    }

    if (embeddingsSummary) {
      parts.push(`\n### Memory Summary`);
      parts.push(
        `Total embeddings: ${embeddingsSummary.total} (${embeddingsSummary.active} active, ${embeddingsSummary.archived} archived)`,
      );
      if (embeddingsSummary.lastCompression) {
        parts.push(
          `Last compression: ${embeddingsSummary.lastCompression.mode} mode, ${(embeddingsSummary.lastCompression.ratio * 100).toFixed(1)}% reduction`,
        );
      }
    }

    return parts.join("\n");
  }

  /**
   * Format embeddings summary separately (for trimming)
   */
  private formatEmbeddingsSummary(embeddingsSummary: {
    total: number;
    active: number;
    archived: number;
    lastCompression?: {
      mode: string;
      ratio: number;
      timestamp: Date;
    };
  }): string {
    const parts: string[] = [];
    parts.push(
      `Total embeddings: ${embeddingsSummary.total} (${embeddingsSummary.active} active, ${embeddingsSummary.archived} archived)`,
    );
    if (embeddingsSummary.lastCompression) {
      parts.push(
        `Last compression: ${embeddingsSummary.lastCompression.mode} mode, ${(embeddingsSummary.lastCompression.ratio * 100).toFixed(1)}% reduction`,
      );
    }
    return parts.join("\n");
  }
}
