import { Injectable, Logger } from "@nestjs/common";
import { Queue, Job, JobsOptions } from "bullmq";

interface JobStatus {
  id: string | undefined;
  name: string | undefined;
  data: unknown;
  state: string;
  progress: number | string | object;
  result: unknown;
  error: string | undefined;
  attemptsMade: number;
  timestamp: number;
}

interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  // Generic method to add a job to any queue
  async addJob<T = unknown>(
    queue: Queue,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T>> {
    try {
      const job = await queue.add(jobName, data, options);
      this.logger.log(`Job ${jobName} added to queue with ID: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to add job ${jobName}:`, error);
      throw error;
    }
  }

  // Get job status by ID
  async getJobStatus(queue: Queue, jobId: string): Promise<JobStatus | null> {
    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = job.progress;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const returnValue = job.returnvalue;

      const failedReason = job.failedReason;

      return {
        id: job.id,
        name: job.name,
        data: job.data,
        state,
        progress: progress as number | string | object,
        result: returnValue,
        error: failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to get job status for ${jobId}:`, error);
      throw error;
    }
  }

  // Get queue metrics
  async getQueueMetrics(queue: Queue): Promise<QueueMetrics> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      };
    } catch (error) {
      this.logger.error("Failed to get queue metrics:", error);
      throw error;
    }
  }

  // Remove a job from the queue
  async removeJob(queue: Queue, jobId: string): Promise<void> {
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Job ${jobId} removed from queue`);
      }
    } catch (error) {
      this.logger.error(`Failed to remove job ${jobId}:`, error);
      throw error;
    }
  }
}
