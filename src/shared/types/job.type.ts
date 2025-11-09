/**
 * Job Processor Types
 * Types for job data, parameters, and results used in the job processor
 */

/**
 * Job data structure passed to BullMQ jobs
 */
export interface JobData {
  jobId: string;
  planId: string;
  userId: string;
  type: string;
  params: Record<string, unknown>;
}

/**
 * Parameters for hotel research jobs
 */
export interface HotelParams {
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

/**
 * Result structure returned by job processors
 */
export interface JobResult {
  success: boolean;
  jobType: string;
  data: Record<string, unknown>;
  summary: string;
  meta: {
    createdAt: string;
    model: string;
    tokensUsed: number;
  };
}
