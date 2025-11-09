import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger, Inject, forwardRef } from "@nestjs/common";
import { Job } from "bullmq";
import { JobState } from "../entities/job.entity";
import { JobsService } from "../services/jobs.service";
import { JobData, JobResult, HotelParams } from "../shared/types/job.type";

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

  // Placeholder methods for specific job types
  private async processResearchHotel(
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    this.logger.log("Processing research_hotel job with params:", params);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const hotelParams = params as HotelParams;
    const location = hotelParams.location ?? "Unknown";

    // TODO: Implement hotel research logic with LLM
    return {
      success: true,
      jobType: "research_hotel",
      data: {
        hotels: [
          {
            name: "Sample Hotel",
            location,
            rating: 4.5,
            price: 100,
          },
        ],
      },
      summary: `Found hotels in ${location}`,
      meta: {
        createdAt: new Date().toISOString(),
        model: "placeholder",
        tokensUsed: 0,
      },
    };
  }

  private async processFindFood(
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    this.logger.log("Processing find_food job with params:", params);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // TODO: Implement food search logic with LLM
    return {
      success: true,
      jobType: "find_food",
      data: {
        restaurants: [],
      },
      summary: "Found restaurants",
      meta: {
        createdAt: new Date().toISOString(),
        model: "placeholder",
        tokensUsed: 0,
      },
    };
  }

  private async processFindAttraction(
    params: Record<string, unknown>,
  ): Promise<JobResult> {
    this.logger.log("Processing find_attraction job with params:", params);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // TODO: Implement attraction search logic with LLM
    return {
      success: true,
      jobType: "find_attraction",
      data: {
        attractions: [],
      },
      summary: "Found attractions",
      meta: {
        createdAt: new Date().toISOString(),
        model: "placeholder",
        tokensUsed: 0,
      },
    };
  }
}
