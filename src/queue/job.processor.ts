import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, forwardRef } from "@nestjs/common";
import { Job } from "bullmq";
import * as llmClient_1 from "src/common/services/llm/llm.client";
import { JobState } from "../entities/job.entity";
import { JobsService } from "../services/jobs.service";
import { JobData, JobResult } from "../shared/types/job.type";
import {
  PromptTemplatesService,
  PromptTemplateError,
} from "../services/prompt-templates.service";
import { MemoryCompressionService } from "../services/memory-compression.service";
import { CompressionResult } from "../shared/types/memory-compression.type";
import { FinalContextComposer } from "../services/context-builders/final-context-composer.service";

/**
 * Research Jobs Processor
 * Processes research-related jobs and updates DB state
 */

@Processor("research-jobs")
export class JobProcessor extends WorkerHost {
  private readonly logger = new Logger(JobProcessor.name);

  constructor(
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
    @Inject(llmClient_1.LLM_CLIENT)
    private readonly llmClient: llmClient_1.LlmClient,
    private readonly promptTemplatesService: PromptTemplatesService,
    private readonly memoryCompressionService: MemoryCompressionService,
    private readonly finalContextComposer: FinalContextComposer,
  ) {
    super();
  }

  async process(job: Job<JobData, JobResult, string>): Promise<JobResult> {
    const { jobId, type, params } = job.data;

    this.logger.log({
      action: "processing_job",
      jobId,
      type,
      bullJobId: job.id,
    });

    try {
      let result: JobResult;

      switch (type) {
        case "research_hotel":
          result = await this.processResearchHotel(params);
          break;
        case "find_food":
          result = await this.processFindFood(params);
          break;
        case "find_attraction":
          result = await this.processFindAttraction(params);
          break;
        case "memory_compression":
          result = await this.processMemoryCompression(job, params);
          break;
        default:
          this.logger.warn(`Unknown job type: ${type}`);
          result = {
            success: false,
            jobType: type,
            data: {},
            summary: "Unknown job type",
            meta: {
              createdAt: new Date().toISOString(),
              model: "unknown",
              tokensUsed: 0,
            },
          };
      }

      return result;
    } catch (error) {
      this.logger.error(`Job ${jobId} processing failed:`, error);
      throw error;
    }
  }

  @OnWorkerEvent("active")
  async onActive(job: Job<JobData>) {
    const { jobId } = job.data;

    this.logger.log({
      action: "job_active",
      jobId,
      bullJobId: job.id,
    });

    // Update DB state to PROCESSING
    await this.jobsService.updateJobState(jobId, {
      state: JobState.PROCESSING,
      startedAt: new Date(),
      workerId: job.id?.toString(),
    });
  }

  @OnWorkerEvent("completed")
  async onCompleted(job: Job<JobData, JobResult>) {
    const { jobId } = job.data;
    const result = job.returnvalue;
    const finishedAt = new Date();
    const startedAt = job.processedOn ? new Date(job.processedOn) : finishedAt;
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    this.logger.log({
      action: "job_completed",
      jobId,
      bullJobId: job.id,
      durationMs,
    });

    // Update DB state to COMPLETED with result
    await this.jobsService.updateJobState(jobId, {
      state: JobState.COMPLETED,
      finishedAt,
      durationMs,
      result: result as unknown as Record<string, unknown>,
    });
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<JobData>, error: Error) {
    const { jobId } = job.data;
    const finishedAt = new Date();
    const startedAt = job.processedOn ? new Date(job.processedOn) : finishedAt;
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    this.logger.error({
      action: "job_failed",
      jobId,
      bullJobId: job.id,
      error: error.message,
      durationMs,
    });

    // Update DB state to FAILED with error
    await this.jobsService.updateJobState(jobId, {
      state: JobState.FAILED,
      finishedAt,
      durationMs,
      error: error.message,
    });
  }

  /**
   * Strips markdown code blocks from LLM response text before JSON parsing.
   * Handles cases where LLM wraps JSON in ```json ... ``` or ``` ... ```
   */
  private stripMarkdownCodeBlocks(text: string): string {
    let cleaned = text.trim();

    // Remove markdown code block markers (```json or ```)
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");

    return cleaned.trim();
  }

  /**
   * Renders a prompt template for the given job type with context.
   * Falls back to hardcoded prompt if template not found (backward compatibility).
   * @param jobType - Job type name (e.g., 'research_hotel')
   * @param params - Job parameters to use as template context
   * @param fallbackPrompt - Hardcoded prompt to use if template rendering fails
   * @returns Rendered prompt string
   */
  private async renderPrompt(
    jobType: string,
    params: Record<string, unknown>,
    fallbackPrompt: string,
  ): Promise<string> {
    try {
      // Build memory context if planId is available
      let contextPrefix = "";
      const planId = params.planId as string | undefined;
      const conversationId = params.conversationId as string | undefined;
      const query = params.query as string | undefined;

      if (planId) {
        try {
          const finalContext = await this.finalContextComposer.composeContext({
            planId,
            conversationId,
            query,
            includeConversation: !!conversationId,
            includeEmbeddings: true,
            includePlan: true,
          });

          if (finalContext.formatted) {
            contextPrefix = finalContext.formatted + "\n\n";
            this.logger.log({
              action: "prompt.context_added",
              jobType,
              planId,
              conversationId,
              contextTokens: finalContext.tokenCount,
            });
          }
        } catch (error) {
          // Log but don't fail - continue without context
          this.logger.warn({
            action: "prompt.context_build_failed",
            jobType,
            planId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const context = {
        ...params,
        jobId: params.jobId,
      };
      const rendered = await this.promptTemplatesService.render(
        jobType,
        context,
      );

      // Prepend context if available
      return contextPrefix + rendered;
    } catch (error) {
      if (error instanceof PromptTemplateError) {
        this.logger.warn({
          action: "template_render_failed_fallback",
          jobType,
          templateId: error.templateId,
          error: error.message,
          usingFallback: true,
        });
      } else {
        this.logger.warn({
          action: "template_render_unexpected_error",
          jobType,
          error: error instanceof Error ? error.message : String(error),
          usingFallback: true,
        });
      }
      // Fallback to hardcoded prompt for backward compatibility
      return fallbackPrompt;
    }
  }

  private async processResearchHotel(
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    const city = params.city as string;
    const nights = params.nights as number;
    const locationDetails = params.locationDetails as string;
    const budget = params.budget as string;
    const reviewScore = params.reviewScore as number;

    if (!city) {
      throw new Error("Missing required parameter: city");
    }

    this.logger.log("Processing research_hotel job with params:", params);

    const locationDetailsPrompt = locationDetails
      ? ` in address ${locationDetails}`
      : "";
    const budgetPrompt = budget ? ` with ${budget} budget` : "";
    const reviewScorePrompt = reviewScore
      ? ` with review score of ${reviewScore}`
      : "";

    const fallbackPrompt = `You are a travel research assistant in VietNam. Find google maps and return hotel recommendations for ${city} ${nights}${locationDetailsPrompt}${budgetPrompt}${reviewScorePrompt}.
Return ONLY valid JSON with this exact structure: {
  "hotels": [
    {
      "name": "Hotel Name",
      "price": "price per night",
      "rating": "rating out of 5",
      "amenities": ["amenity1", "amenity2"],
      "location": "specific area in city",
      "address": "address of the hotel",
      "link_google_maps": "link to the hotel on google maps",

    }
  ]
}`;

    console.log("fallbackPrompt", fallbackPrompt);

    const prompt = await this.renderPrompt(
      "research_hotel",
      params,
      fallbackPrompt,
    );

    const { text, usage, model } = await this.llmClient.generate(prompt, {
      jobId: params.jobId as string,
      temperature: 0.3,
      maxTokens: 2000,
    });
    console.log("text", text);
    // Parse JSON safely
    let parsedData: Record<string, unknown>;
    try {
      const cleanedText = this.stripMarkdownCodeBlocks(text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(cleanedText);
      parsedData = parsed as Record<string, unknown>;
    } catch (error) {
      this.logger.error("Failed to parse LLM response as JSON:", {
        error: error instanceof Error ? error.message : "Unknown error",
        text: text.substring(0, 200),
      });
      throw new Error(
        `Failed to parse JSON from LLM response: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return {
      success: true,
      jobType: "research_hotel",
      data: parsedData,
      summary: `Found ${(parsedData?.hotels as unknown[])?.length ?? 0} hotels in ${city}`,
      meta: {
        createdAt: new Date().toISOString(),
        model: model ?? "unknown",
        tokensUsed: usage?.total ?? 0,
      },
    };
  }

  private async processFindFood(
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    const city = params.city as string;
    const cuisine = params.cuisine as string;
    const budget = params.budget as string;

    if (!city) {
      throw new Error("Missing required parameter: city");
    }

    this.logger.log("Processing find_food job with params:", params);

    const fallbackPrompt = `You are a travel research assistant. Find and return restaurant recommendations for ${city}${cuisine ? ` specializing in ${cuisine} cuisine` : ""}${budget ? ` with ${budget} budget` : ""}.
Return ONLY valid JSON with this exact structure:
{
  "restaurants": [
    {
      "name": "Restaurant Name",
      "cuisine": "cuisine type",
      "priceRange": "$ or $$ or $$$ or $$$$",
      "rating": "rating out of 5",
      "specialties": ["dish1", "dish2"],
      "location": "specific area in city",
      "description": "brief description"
    }
  ]
}`;

    const prompt = await this.renderPrompt("find_food", params, fallbackPrompt);

    const { text, usage, model } = await this.llmClient.generate(prompt, {
      jobId: params.jobId as string,
      temperature: 0.4,
      maxTokens: 2000,
    });

    let parsedData: Record<string, unknown>;
    try {
      const cleanedText = this.stripMarkdownCodeBlocks(text);
      parsedData = JSON.parse(cleanedText) as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        `Failed to parse JSON from LLM response: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return {
      success: true,
      jobType: "find_food",
      data: parsedData,
      summary: `Found ${(parsedData?.restaurants as unknown[])?.length ?? 0} restaurants in ${city}`,
      meta: {
        createdAt: new Date().toISOString(),
        model: model ?? "unknown",
        tokensUsed: usage?.total ?? 0,
      },
    };
  }

  private async processFindAttraction(
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    const city = params.city as string;
    const category = params.category as string;
    const duration = params.duration as string;

    if (!city) {
      throw new Error("Missing required parameter: city");
    }

    this.logger.log("Processing find_attraction job with params:", params);

    const fallbackPrompt = `You are a travel research assistant. Find and return tourist attraction recommendations for ${city}${category ? ` in the ${category} category` : ""}${duration ? ` suitable for ${duration} visits` : ""}.
Return ONLY valid JSON with this exact structure:
{
  "attractions": [
    {
      "name": "Attraction Name",
      "category": "category type (museum, park, historical, etc.)",
      "rating": "rating out of 5",
      "estimatedDuration": "typical visit duration",
      "entryFee": "entry fee or 'Free'",
      "location": "specific area in city",
      "highlights": ["highlight1", "highlight2"],
      "description": "brief description"
    }
  ]
}`;

    const prompt = await this.renderPrompt(
      "find_attraction",
      params,
      fallbackPrompt,
    );

    const { text, usage, model } = await this.llmClient.generate(prompt, {
      jobId: params.jobId as string,
      temperature: 0.4,
      maxTokens: 2000,
    });

    // Parse JSON safely
    let parsedData: Record<string, unknown>;
    try {
      const cleanedText = this.stripMarkdownCodeBlocks(text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(cleanedText);
      parsedData = parsed as Record<string, unknown>;
    } catch (error) {
      this.logger.error("Failed to parse LLM response as JSON:", {
        error: error instanceof Error ? error.message : "Unknown error",
        text: text.substring(0, 200),
      });
      throw new Error(
        `Failed to parse JSON from LLM response: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return {
      success: true,
      jobType: "find_attraction",
      data: parsedData,
      summary: `Found ${(parsedData?.attractions as unknown[])?.length ?? 0} attractions in ${city}`,
      meta: {
        createdAt: new Date().toISOString(),
        model: model ?? "unknown",
        tokensUsed: usage?.total ?? 0,
      },
    };
  }

  private async processMemoryCompression(
    job: Job<JobData, JobResult, string>,
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    const planId = params.planId as string;
    const mode = params.mode as "light" | "full";
    const userId = params.userId as string | undefined;
    const dryRun = params.dryRun as boolean | undefined;

    if (!planId) {
      throw new Error("Missing required parameter: planId");
    }

    if (!mode || (mode !== "light" && mode !== "full")) {
      throw new Error(
        "Missing or invalid parameter: mode (must be 'light' or 'full')",
      );
    }

    // Track metrics: start time, CPU usage, memory
    const processingStartTime = Date.now();
    const cpuUsageBefore = process.cpuUsage();
    const memoryUsageBefore = process.memoryUsage();

    // Calculate queue time (time from job creation to processing start)
    const queueTimeMs = job.processedOn
      ? job.processedOn - (job.timestamp || Date.now())
      : 0;

    this.logger.log({
      action: "memory_compression.worker.start",
      planId,
      mode,
      userId: userId ?? null,
      dryRun: dryRun ?? false,
      queueTimeMs,
      jobCreatedAt: job.timestamp
        ? new Date(job.timestamp).toISOString()
        : null,
    });

    let compressionResult: CompressionResult;
    try {
      compressionResult =
        await this.memoryCompressionService.compressPlanMemory(
          planId,
          mode,
          userId,
          { dryRun },
        );
    } finally {
      // Track metrics: end time, CPU usage, memory
      const processingEndTime = Date.now();
      const processingDurationMs = processingEndTime - processingStartTime;
      const cpuUsageAfter = process.cpuUsage(cpuUsageBefore);
      const memoryUsageAfter = process.memoryUsage();

      // Calculate CPU usage
      const cpuUserMs = cpuUsageAfter.user / 1000; // Convert microseconds to milliseconds
      const cpuSystemMs = cpuUsageAfter.system / 1000;
      const cpuTotalMs = cpuUserMs + cpuSystemMs;
      const cpuPercentage =
        processingDurationMs > 0
          ? ((cpuTotalMs / processingDurationMs) * 100).toFixed(2)
          : "0.00";

      // Memory delta
      const memoryDeltaMB = {
        rss: (memoryUsageAfter.rss - memoryUsageBefore.rss) / 1024 / 1024,
        heapTotal:
          (memoryUsageAfter.heapTotal - memoryUsageBefore.heapTotal) /
          1024 /
          1024,
        heapUsed:
          (memoryUsageAfter.heapUsed - memoryUsageBefore.heapUsed) /
          1024 /
          1024,
        external:
          (memoryUsageAfter.external - memoryUsageBefore.external) /
          1024 /
          1024,
      };

      // Log worker metrics
      this.logger.log({
        action: "memory_compression.worker.metrics",
        planId,
        mode,
        queueTimeMs,
        processingDurationMs,
        totalLatencyMs: queueTimeMs + processingDurationMs,
        cpu: {
          userMs: cpuUserMs.toFixed(2),
          systemMs: cpuSystemMs.toFixed(2),
          totalMs: cpuTotalMs.toFixed(2),
          percentage: cpuPercentage,
        },
        memory: {
          rssMB: memoryUsageAfter.rss / 1024 / 1024,
          heapTotalMB: memoryUsageAfter.heapTotal / 1024 / 1024,
          heapUsedMB: memoryUsageAfter.heapUsed / 1024 / 1024,
          externalMB: memoryUsageAfter.external / 1024 / 1024,
          deltaMB: memoryDeltaMB,
        },
      });
    }

    if (!compressionResult) {
      throw new Error("Compression result is missing");
    }

    return {
      success: true,
      jobType: "memory_compression",
      data: compressionResult as unknown as Record<string, unknown>,
      summary: `Compressed ${compressionResult.beforeCount} embeddings to ${compressionResult.afterCount} (ratio: ${compressionResult.compressionRatio.toFixed(2)})`,
      meta: {
        createdAt: new Date().toISOString(),
        model: "memory-compression",
        tokensUsed: 0,
      },
    };
  }
}
