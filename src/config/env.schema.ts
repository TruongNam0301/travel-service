import { z } from "zod";
import { JWT_CONSTANTS } from "../shared/constants/jwt.constant";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // Database
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string().default("postgres"),
  POSTGRES_PASSWORD: z.string().default("postgres"),
  POSTGRES_DB: z.string().default("travel_db"),

  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Queue
  QUEUE_CONCURRENCY: z.coerce.number().default(5),

  // Conversations
  CREATE_DEFAULT_CONVERSATION: z.coerce.boolean().default(true),

  // Security
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:5173"),
  RATE_LIMIT_TTL: z.coerce.number().default(60), // seconds
  RATE_LIMIT_MAX: z.coerce.number().default(100), // max requests per TTL

  // JWT Authentication
  [JWT_CONSTANTS.ENV_KEYS.JWT_SECRET]: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  [JWT_CONSTANTS.ENV_KEYS.JWT_REFRESH_SECRET]: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  [JWT_CONSTANTS.ENV_KEYS.JWT_ACCESS_EXPIRATION]: z.string().default("1d"),
  [JWT_CONSTANTS.ENV_KEYS.JWT_REFRESH_EXPIRATION]: z.string().default("7d"),
  [JWT_CONSTANTS.ENV_KEYS.JWT_ISSUER]: z
    .string()
    .default(JWT_CONSTANTS.DEFAULT_ISSUER),
  [JWT_CONSTANTS.ENV_KEYS.JWT_AUDIENCE]: z
    .string()
    .default(JWT_CONSTANTS.DEFAULT_AUDIENCE),

  // LLM Provider
  LLM_PROVIDER: z.enum(["openai"]).default("openai"),

  // OpenAI Configuration (new preferred format)
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY required").optional(),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1").optional(),
  OPENAI_CHAT_MODEL: z.string().default("gpt-4o-mini").optional(),
  OPENAI_EMBED_MODEL: z.string().default("text-embedding-3-small").optional(),
  OPENAI_TIMEOUT_MS: z.coerce.number().default(60000).optional(),
  OPENAI_MAX_RETRIES: z.coerce.number().default(2).optional(),
  OPENAI_PROJECT_ID: z.string().optional(),
  OPENAI_ORG_ID: z.string().optional(),

  // Model Routing - Chat Modes
  OPENAI_CHAT_MODEL_DEFAULT: z.string().optional(),
  OPENAI_CHAT_MODEL_SUMMARY: z.string().optional(),
  OPENAI_CHAT_MODEL_PLANNING: z.string().optional(),

  // Model Routing - Job Types
  JOB_MODEL_RESEARCH_HOTEL: z.string().optional(),
  JOB_MODEL_RESEARCH_FOOD: z.string().optional(),
  JOB_MODEL_RESEARCH_ATTRACTION: z.string().optional(),
  JOB_MODEL_MEMORY_COMPRESSION: z.string().optional(),

  // LLM (legacy - kept for backward compatibility)
  LLM_API_KEY: z.string().min(1).optional(),
  LLM_MODEL: z.string().optional(),
  LLM_EMBED_MODEL: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().optional(),
  LLM_MAX_RETRIES: z.coerce.number().optional(),
  LLM_BASE_URL: z.string().optional(),

  // Vector Search
  VECTOR_SEARCH_MODE: z.enum(["cosine", "hnsw"]).default("hnsw"),
  VECTOR_HNSW_M: z.coerce.number().default(16),
  VECTOR_HNSW_EF_CONSTRUCTION: z.coerce.number().default(64),

  // Google Maps API (optional - for real data crawling)
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_MAPS_CACHE_TTL: z.coerce.number().default(3600), // 1 hour
  GOOGLE_MAPS_GRID_RADIUS_KM: z.coerce.number().default(20), // 20km search radius
  GOOGLE_MAPS_CELL_SIZE_KM: z.coerce.number().default(3), // 3km grid cells
  GOOGLE_MAPS_STALE_DAYS: z.coerce.number().default(30), // Re-crawl after 30 days
  GOOGLE_MAPS_QPS: z.coerce.number().default(10), // Queries per second
  GOOGLE_MAPS_DEFAULT_LANGUAGE: z.string().default("vi"), // Vietnamese
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    console.error("❌ Environment validation failed:");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error("Invalid environment configuration");
  }

  return parsed.data;
}
