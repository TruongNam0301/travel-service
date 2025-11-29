import { z } from "zod";

/**
 * Environment validation schema
 * Most fields are optional with defaults set in domain config files
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).optional(),
  PORT: z.coerce.number().optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .optional(),

  // Database
  POSTGRES_HOST: z.string().optional(),
  POSTGRES_PORT: z.coerce.number().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DB: z.string().optional(),

  // Redis
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Queue
  QUEUE_CONCURRENCY: z.coerce.number().optional(),

  // Security
  CORS_ORIGINS: z.string().optional(),
  RATE_LIMIT_TTL: z.coerce.number().optional(),
  RATE_LIMIT_MAX: z.coerce.number().optional(),

  // JWT Authentication (Required in production)
  JWT_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_ACCESS_EXPIRATION: z.coerce.number().optional(),
  JWT_REFRESH_EXPIRATION: z.coerce.number().optional(),
  JWT_ISSUER: z.string().optional(),
  JWT_AUDIENCE: z.string().optional(),

  // LLM Provider (Required for AI features)
  LLM_PROVIDER: z.enum(["openai"]).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),

  // Vector Search
  VECTOR_SEARCH_MODE: z.enum(["cosine", "hnsw"]).optional(),
  VECTOR_HNSW_M: z.coerce.number().optional(),
  VECTOR_HNSW_EF_CONSTRUCTION: z.coerce.number().optional(),

  // Google Maps API
  GOOGLE_MAPS_API_KEY: z.string().optional(),
});

export function validateEnv(
  config: Record<string, unknown>,
): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    console.error("Environment validation errors:", parsed.error.format());
    throw new Error(
      `Invalid environment configuration: ${parsed.error.message}`,
    );
  }

  return parsed.data;
}
