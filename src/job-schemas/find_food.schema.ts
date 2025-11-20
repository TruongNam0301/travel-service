import { z } from "zod";

/**
 * Schema for find_food job parameters
 * Supports both new spec format (destination) and legacy format (city)
 */
export const FindFoodParamsSchema = z
  .object({
    // New spec format
    destination: z.string().min(1, "Destination is required").optional(),
    preferences: z.string().nullable().optional(),
    budget: z.string().nullable().optional(),
    // Legacy format (for backward compatibility)
    city: z.string().min(1, "City is required").optional(),
    locationDetails: z.string().optional(),
    cuisine: z.string().optional(),
    reviewScore: z.number().int().positive().optional(),
    // Additional fields from LLM
    location: z.string().optional(),
    priceRange: z.string().optional(),
    mealType: z.string().optional(),
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
 * Schema for find_food job result structure
 * Matches the expected JSON output from LLM
 */
export const FindFoodResultSchema = z.object({
  jobType: z.literal("find_food"),
  params: z.object({
    destination: z.string(),
    location: z.string().nullable().optional(),
    preferences: z.string().nullable(),
    budget: z.string().nullable(),
  }),
  data: z.object({
    restaurants: z.array(
      z.object({
        name: z.string(),
        cuisine: z.string(),
        location: z.string(),
        priceLevel: z.string().nullable(),
        rating: z.number().nullable(),
        signatureDishes: z.array(z.string()),
        whyRecommended: z.string(),
      }),
    ),
  }),
  summary: z.string(),
  meta: z.object({
    createdAt: z.string(),
    model: z.string(),
  }),
});

export type FindFoodParams = z.infer<typeof FindFoodParamsSchema>;
export type FindFoodResult = z.infer<typeof FindFoodResultSchema>;
