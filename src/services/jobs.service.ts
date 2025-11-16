import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Repository, FindOptionsWhere } from "typeorm";
import { Queue } from "bullmq";
import { Job, JobState } from "../entities/job.entity";
import { Plan } from "../entities/plan.entity";
import { CreateJobDto } from "../dto/jobs/create-job.dto";
import { UpdateJobDto } from "../dto/jobs/update-job.dto";
import { QueryJobsDto } from "../dto/jobs/query-jobs.dto";
import { PlansService } from "./plans.service";
import { JobTypesService } from "./job-types.service";
import { PaginatedResponse } from "../common/dto/paginated-response.dto";

interface JobStateUpdate {
  state?: JobState;
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  result?: Record<string, any>;
  error?: string;
  workerId?: string;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Job)
    private readonly jobsRepository: Repository<Job>,
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
    @InjectQueue("research-jobs")
    private readonly researchQueue: Queue,
    private readonly plansService: PlansService,
    private readonly jobTypesService: JobTypesService,
  ) {}

  /**
   * Create and enqueue a job
   * Entity-first pattern: create DB record → enqueue to BullMQ
   */
  async create(
    planId: string,
    userId: string,
    createJobDto: CreateJobDto,
  ): Promise<Job> {
    // Verify plan ownership (throws if not owner)
    await this.plansService.verifyOwnership(planId, userId);

    // Validate job parameters before creating entity
    this.jobTypesService.validate(createJobDto.type, createJobDto.params || {});

    this.logger.log({
      action: "create_job",
      userId,
      planId,
      type: createJobDto.type,
    });

    // Step 1: Create job entity in PENDING state
    const job = this.jobsRepository.create({
      planId,
      type: createJobDto.type,
      params: createJobDto.params || {},
      state: JobState.PENDING,
      priority: createJobDto.priority || 0,
      retries: 0,
    });

    const savedJob = await this.jobsRepository.save(job);

    // Step 2: Enqueue to BullMQ using job.id as jobId for idempotency
    try {
      await this.researchQueue.add(
        createJobDto.type,
        {
          jobId: savedJob.id,
          planId,
          userId,
          type: createJobDto.type,
          params: createJobDto.params || {},
        },
        {
          jobId: savedJob.id, // Use DB job.id as BullMQ jobId
          priority: createJobDto.priority || 0,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      );

      // Update state to QUEUED after successful enqueue
      savedJob.state = JobState.QUEUED;
      await this.jobsRepository.save(savedJob);

      this.logger.log({
        action: "job_enqueued",
        userId,
        planId,
        jobId: savedJob.id,
      });

      return savedJob;
    } catch (error) {
      // Handle enqueue failure
      this.logger.error({
        action: "job_enqueue_failed",
        userId,
        planId,
        jobId: savedJob.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Update job state to reflect enqueue failure
      savedJob.state = JobState.FAILED;
      savedJob.error = `Enqueue failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      await this.jobsRepository.save(savedJob);

      throw new InternalServerErrorException(
        "Failed to enqueue job. Please try again.",
      );
    }
  }

  /**
   * Find all jobs for a plan with pagination and filters
   */
  async findAllByPlan(
    planId: string,
    userId: string,
    query: QueryJobsDto,
  ): Promise<PaginatedResponse<Job>> {
    // Verify plan ownership (throws if not owner)
    await this.plansService.verifyOwnership(planId, userId);

    const {
      page = 1,
      limit = 10,
      state,
      type,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Job> = {
      planId,
    };

    if (state) {
      where.state = state;
    }

    if (type) {
      where.type = type;
    }

    const [data, total] = await this.jobsRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: {
        [sortBy]: sortOrder,
      },
    });

    const totalPages = Math.ceil(total / limit);

    this.logger.log({
      action: "list_jobs",
      userId,
      planId,
      total,
      page,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Find one job by ID with ownership check
   */
  async findOne(jobId: string, userId: string): Promise<Job> {
    const job = await this.jobsRepository.findOne({
      where: { id: jobId },
      relations: ["plan"],
    });

    if (!job) {
      throw new NotFoundException(`Job with id ${jobId} not found`);
    }

    // Ownership check via plan
    if (job.plan.userId !== userId) {
      this.logger.warn({
        action: "unauthorized_job_access",
        userId,
        jobId,
        ownerId: job.plan.userId,
      });
      throw new NotFoundException(`Job with id ${jobId} not found`);
    }

    return job;
  }

  /**
   * Update job parameters (only for QUEUED/FAILED jobs)
   */
  async update(
    jobId: string,
    userId: string,
    updateJobDto: UpdateJobDto,
  ): Promise<Job> {
    const job = await this.findOne(jobId, userId);

    // Only allow param updates for jobs that haven't started processing
    if (
      job.state !== JobState.QUEUED &&
      job.state !== JobState.PENDING &&
      job.state !== JobState.FAILED
    ) {
      throw new BadRequestException(
        `Cannot update job in ${job.state} state. Only QUEUED, PENDING, or FAILED jobs can be updated.`,
      );
    }

    this.logger.log({
      action: "update_job",
      userId,
      jobId,
      updates: Object.keys(updateJobDto),
    });

    if (updateJobDto.params) {
      job.params = { ...job.params, ...updateJobDto.params };
    }

    const updatedJob = await this.jobsRepository.save(job);

    this.logger.log({
      action: "job_updated",
      userId,
      jobId,
    });

    return updatedJob;
  }

  /**
   * Cancel a job (remove from queue if not started)
   */
  async cancel(jobId: string, userId: string): Promise<void> {
    const job = await this.findOne(jobId, userId);

    // Only allow cancellation for queued/pending jobs
    if (job.state !== JobState.QUEUED && job.state !== JobState.PENDING) {
      throw new BadRequestException(
        `Cannot cancel job in ${job.state} state. Only QUEUED or PENDING jobs can be cancelled.`,
      );
    }

    this.logger.log({
      action: "cancel_job",
      userId,
      jobId,
    });

    // Remove from BullMQ queue
    try {
      const bullJob = await this.researchQueue.getJob(jobId);
      if (bullJob) {
        await bullJob.remove();
      }
    } catch (error) {
      this.logger.warn({
        action: "job_removal_from_queue_failed",
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Update job state
    job.state = JobState.CANCELLED;
    job.finishedAt = new Date();
    await this.jobsRepository.save(job);

    this.logger.log({
      action: "job_cancelled",
      userId,
      jobId,
    });
  }

  /**
   * Update job state (called by worker)
   * Internal method for worker to update job states
   */
  async updateJobState(jobId: string, updates: JobStateUpdate): Promise<void> {
    const job = await this.jobsRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      this.logger.error({
        action: "job_not_found_for_state_update",
        jobId,
      });
      return;
    }

    // Apply updates
    if (updates.state) {
      job.state = updates.state;
    }
    if (updates.startedAt) {
      job.startedAt = updates.startedAt;
    }
    if (updates.finishedAt) {
      job.finishedAt = updates.finishedAt;
    }
    if (updates.durationMs !== undefined) {
      job.durationMs = updates.durationMs;
    }
    if (updates.result) {
      job.result = updates.result;
    }
    if (updates.error) {
      job.error = updates.error;
    }
    if (updates.workerId) {
      job.workerId = updates.workerId;
    }

    await this.jobsRepository.save(job);

    this.logger.log({
      action: "job_state_updated",
      jobId,
      newState: updates.state,
    });
  }

  /**
   * Get recent completed jobs for a plan (internal use, no ownership check)
   * Used by context builders
   */
  async getRecentJobsInternal(planId: string, limit: number): Promise<Job[]> {
    return await this.jobsRepository.find({
      where: {
        planId,
        state: JobState.COMPLETED,
      },
      order: {
        finishedAt: "DESC",
        createdAt: "DESC",
      },
      take: limit,
    });
  }
}
