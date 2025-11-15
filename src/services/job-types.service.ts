import { Injectable, BadRequestException } from "@nestjs/common";
import { z } from "zod";

/**
 * JobTypesService
 * Validates job parameters using Zod schemas before enqueueing
 */
@Injectable()
export class JobTypesService {
  // Hardcoded Zod schemas for job types
  private readonly schemas: Record<string, z.ZodSchema> = {
    research_hotel: z.object({
      city: z.string().min(1, "City is required"),
      locationDetails: z.string().optional(),
      budget: z.string().optional(),
      nights: z.number().int().positive().optional(),
      reviewScore: z.number().int().positive().optional(),
    }),

    find_food: z.object({
      city: z.string().min(1, "City is required"),
      locationDetails: z.string().optional(),
      cuisine: z.string().optional(),
      budget: z.string().optional(),
      reviewScore: z.number().int().positive().optional(),
    }),

    find_attraction: z.object({
      city: z.string().min(1, "City is required"),
      category: z.string().optional(),
      duration: z.string().optional(),
      reviewScore: z.number().int().positive().optional(),
    }),

    memory_compression: z.object({
      planId: z.string().uuid("planId must be a valid UUID"),
      mode: z.enum(["light", "full"], {
        message: "mode must be either 'light' or 'full'",
      }),
    }),
  };

  /**
   * Validate job parameters for a given job type
   * @param type - Job type (e.g., 'research_hotel', 'find_food', 'find_attraction')
   * @param params - Job parameters to validate
   * @throws BadRequestException if validation fails or job type is unknown
   */
  validate(type: string, params: Record<string, any>): void {
    const schema = this.schemas[type];

    if (!schema) {
      throw new BadRequestException(
        `Unknown job type: ${type}. Supported types: ${Object.keys(this.schemas).join(", ")}`,
      );
    }

    const result = schema.safeParse(params);

    if (!result.success) {
      const formattedErrors = this.formatZodErrors(result.error);
      throw new BadRequestException({
        message: "Job parameter validation failed",
        errors: formattedErrors,
      });
    }
  }

  /**
   * Format Zod errors into a user-friendly structure
   * @param error - Zod error object
   * @returns Formatted error array with field paths and messages
   */
  private formatZodErrors(error: z.ZodError): Array<{
    path: string;
    message: string;
  }> {
    return error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  }
}
