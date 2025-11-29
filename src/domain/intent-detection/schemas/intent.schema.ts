import { z } from "zod";

/**
 * Valid intent types for classification
 */
export const IntentType = z.enum([
  "default",
  "planning",
  "summarization",
  "job_request",
]);

/**
 * Valid job types for MVP (hotel/homestay only)
 * Will be expanded later for food, attractions, etc.
 */
export const JobType = z.enum(["research_hotel"]);

/**
 * Schema for LLM classification response
 * Includes confidence scoring for better decision making
 */
export const DetectedIntentSchema = z
  .object({
    intent: IntentType,
    jobType: JobType.nullable(),
    confidence: z.number().min(0).max(1),
  })
  .refine(
    (data) => {
      // If intent is job_request, jobType must be provided
      if (data.intent === "job_request") {
        return data.jobType !== null;
      }
      return true;
    },
    {
      message: "jobType is required when intent is job_request",
      path: ["jobType"],
    },
  )
  .refine(
    (data) => {
      // If intent is NOT job_request, jobType should be null
      if (data.intent !== "job_request") {
        return data.jobType === null;
      }
      return true;
    },
    {
      message: "jobType must be null when intent is not job_request",
      path: ["jobType"],
    },
  );

/**
 * Inferred TypeScript types from schemas
 */
export type IntentType = z.infer<typeof IntentType>;
export type JobType = z.infer<typeof JobType>;
export type DetectedIntent = z.infer<typeof DetectedIntentSchema>;

/**
 * Default fallback intent when classification fails or confidence is low
 */
export const DEFAULT_INTENT: DetectedIntent = {
  intent: "default",
  jobType: null,
  confidence: 0,
};

/**
 * Confidence threshold - below this, fallback to default intent
 */
export const CONFIDENCE_THRESHOLD = 0.7;
