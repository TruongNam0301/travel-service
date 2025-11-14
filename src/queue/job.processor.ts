import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, forwardRef } from "@nestjs/common";
import { Job } from "bullmq";
import * as llmClient_1 from "src/common/services/llm/llm.client";
import { JobState } from "../entities/job.entity";
import { JobsService } from "../services/jobs.service";
import { JobData, JobResult } from "../shared/types/job.type";

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

  private async processResearchHotel(
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    const city = params.city as string;
    const nights = params.nights as number;

    if (!city) {
      throw new Error("Missing required parameter: city");
    }

    this.logger.log("Processing research_hotel job with params:", params);

    const prompt = `You are a travel research assistant. Find and return hotel recommendations for ${city}${nights ? ` for ${nights} nights` : ""}.
Return ONLY valid JSON with this exact structure:
{
  "hotels": [
    {
      "name": "Hotel Name",
      "price": "price per night",
      "rating": "rating out of 5",
      "amenities": ["amenity1", "amenity2"],
      "location": "specific area in city"
    }
  ]
}`;

    const { text, usage, model } = await this.llmClient.generate(prompt, {
      jobId: params.jobId as string,
      temperature: 0.3,
      maxTokens: 2000,
    });

    // Parse JSON safely
    let parsedData: Record<string, unknown>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(text);
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

    const prompt = `You are a travel research assistant. Find and return restaurant recommendations for ${city}${cuisine ? ` specializing in ${cuisine} cuisine` : ""}${budget ? ` with ${budget} budget` : ""}.
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

    const { text, usage, model } = await this.llmClient.generate(prompt, {
      jobId: params.jobId as string,
      temperature: 0.4,
      maxTokens: 2000,
    });

    // Parse JSON safely
    let parsedData: Record<string, unknown>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(text);
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

    const prompt = `You are a travel research assistant. Find and return tourist attraction recommendations for ${city}${category ? ` in the ${category} category` : ""}${duration ? ` suitable for ${duration} visits` : ""}.
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

    const { text, usage, model } = await this.llmClient.generate(prompt, {
      jobId: params.jobId as string,
      temperature: 0.4,
      maxTokens: 2000,
    });

    // Parse JSON safely
    let parsedData: Record<string, unknown>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(text);
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
}
