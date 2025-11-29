import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { DatabaseModule } from "../infrastructure/database/database.module";
import { CacheConfigModule } from "../infrastructure/cache/cache.module";
import { QueueModule } from "../infrastructure/queue/queue.module";
import { validateEnv } from "../config/env.schema";
import appConfig from "../config/app.config";
import databaseConfig from "../config/database.config";
import redisConfig from "../config/redis.config";
import queueConfig from "../config/queue.config";
import jwtConfig from "../config/jwt.config";
import llmConfig from "../config/llm.config";
import vectorConfig from "../config/vector.config";
import contextBuilderConfig from "../config/context-builder.config";
import memoryCompressionConfig from "../config/memory-compression.config";
import { getLoggerConfig } from "../config/logger.config";

/**
 * AppCoreModule aggregates all core infrastructure modules.
 * This keeps AppModule clean and allows reuse across workers or CLI tools.
 *
 * All infrastructure modules are exported so they can be used by feature modules.
 *
 * Configuration is split by domain:
 * - app: Application settings (port, environment, CORS, rate limiting)
 * - database: PostgreSQL connection and behavior
 * - redis: Redis connection settings
 * - queue: BullMQ queue configuration
 * - jwt: JWT authentication settings
 * - llm: LLM provider configuration (OpenAI, etc.)
 * - vector: Vector search settings
 * - contextBuilder: Memory context builder settings
 * - memoryCompression: Memory compression scheduler settings
 */
@Global()
@Module({
  imports: [
    // Configuration with Zod validation and environment-specific loading
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        queueConfig,
        jwtConfig,
        llmConfig,
        vectorConfig,
        contextBuilderConfig,
        memoryCompressionConfig,
      ],
      // Load environment-specific config first, then fall back to .env
      envFilePath: [
        `.env.${process.env.NODE_ENV || "development"}`,
        ".env.local",
        ".env",
      ],
    }),

    // Logger with Pino
    LoggerModule.forRoot(getLoggerConfig()),

    // Task Scheduling (CRON jobs)
    ScheduleModule.forRoot(),

    // Database with TypeORM
    DatabaseModule,

    // Redis Cache
    CacheConfigModule,

    // BullMQ Queue
    QueueModule,
  ],
  providers: [],
  exports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    CacheConfigModule,
    QueueModule,
  ],
})
export class AppCoreModule {}
