import { z } from "zod";

/**
 * Schema for find_attraction job parameters
 * Supports both new spec format (destination) and legacy format (city)
 */
export const FindAttractionParamsSchema = z
  .object({
    // New spec format
    destination: z.string().min(1, "Destination is required").optional(),
    tripStyle: z.string().nullable().optional(),
    duration: z.string().nullable().optional(),
    // Legacy format (for backward compatibility)
    city: z.string().min(1, "City is required").optional(),
    category: z.string().optional(),
    reviewScore: z.number().int().positive().optional(),
    // Additional fields from LLM
    location: z.string().optional(),
    attractionType: z.string().optional(),
    // Metadata fields (added by chat service)
    conversationId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    query: z.string().optional(),
  })
  .passthrough() // Allow additional unknown fields
  .refine((data) => data.destination || data.city || data.location, {
    message: "Either destination, city, or location must be provided",
    path: ["destination"],
  });

/**
 * Schema for find_attraction job result structure
 * Matches the expected JSON output from LLM
 */
export const FindAttractionResultSchema = z.object({
  jobType: z.literal("find_attraction"),
  params: z.object({
    destination: z.string(),
    tripStyle: z.string().nullable(),
    duration: z.string().nullable(),
  }),
  data: z.object({
    attractions: z.array(
      z.object({
        name: z.string(),
        location: z.string(),
        durationNeeded: z.string().nullable(),
        bestTimeToVisit: z.string().nullable(),
        description: z.string(),
        highlights: z.array(z.string()),
      }),
    ),
  }),
  summary: z.string(),
  meta: z.object({
    createdAt: z.string(),
    model: z.string(),
  }),
});

export type FindAttractionParams = z.infer<typeof FindAttractionParamsSchema>;
export type FindAttractionResult = z.infer<typeof FindAttractionResultSchema>;
