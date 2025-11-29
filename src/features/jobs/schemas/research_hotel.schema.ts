import { z } from "zod";

/**
 * Schema for research_hotel job parameters
 * Supports both new spec format (destination) and legacy format (city)
 */
export const ResearchHotelParamsSchema = z
  .object({
    // New spec format
    destination: z.string().min(1, "Destination is required").optional(),
    budget: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    people: z.number().int().positive().nullable().optional(),
    // Legacy format (for backward compatibility)
    city: z.string().min(1, "City is required").optional(),
    locationDetails: z.string().optional(),
    nights: z.number().int().positive().optional(),
    reviewScore: z.number().int().positive().optional(),
    // Additional fields from LLM or chat service
    location: z.string().optional(),
    checkInDate: z.string().optional(),
    checkOutDate: z.string().optional(),
    budgetPerNight: z.number().optional(),
    currency: z.string().optional(),
    minRating: z.number().optional(),
    guests: z.number().optional(),
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
 * Schema for research_hotel job result structure
 * Matches the expected JSON output from LLM
 */
export const ResearchHotelResultSchema = z.object({
  jobType: z.literal("research_hotel"),
  params: z.object({
    destination: z.string(),
    location: z.string().nullable().optional(),
    budget: z.string().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    people: z.number().nullable(),
  }),
  data: z.object({
    hotels: z.array(
      z.object({
        name: z.string(),
        location: z.string(),
        price: z.number().nullable(),
        rating: z.number().nullable(),
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

export type ResearchHotelParams = z.infer<typeof ResearchHotelParamsSchema>;
export type ResearchHotelResult = z.infer<typeof ResearchHotelResultSchema>;
