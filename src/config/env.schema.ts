import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  // Database
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),
  POSTGRES_DB: z.string().default('travel_db'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Queue
  QUEUE_CONCURRENCY: z.coerce.number().default(5),

  // Security
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173'),
  RATE_LIMIT_TTL: z.coerce.number().default(60), // seconds
  RATE_LIMIT_MAX: z.coerce.number().default(100), // max requests per TTL
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error('Invalid environment configuration');
  }

  return parsed.data;
}
