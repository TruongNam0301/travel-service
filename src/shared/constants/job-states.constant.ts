/**
 * Job State Constants
 * Centralized definition of all possible job states
 */
export const JOB_STATES = {
  QUEUED: "queued",
  PENDING: "pending",
  PROCESSING: "processing",
  RETRYING: "retrying",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type JobState = (typeof JOB_STATES)[keyof typeof JOB_STATES];

export const OPEN_JOB_STATES = [
  JOB_STATES.QUEUED,
  JOB_STATES.PENDING,
  JOB_STATES.PROCESSING,
  JOB_STATES.RETRYING,
] as const;

export const TERMINAL_JOB_STATES = [
  JOB_STATES.COMPLETED,
  JOB_STATES.FAILED,
  JOB_STATES.CANCELLED,
] as const;
