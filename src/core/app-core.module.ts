import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { DatabaseModule } from "../database/database.module";
import { CacheConfigModule } from "./cache.module";
import { QueueModule } from "../queue/queue.module";
import { validateEnv } from "../config/env.schema";
import databaseConfig from "../config/database.config";
import redisConfig from "../config/redis.config";
import queueConfig from "../config/queue.config";
import appConfig from "../config/app.config";
import memoryCompressionConfig from "../config/memory-compression.config";
import contextBuilderConfig from "../config/context-builder.config";
import { getLoggerConfig } from "../config/logger.config";

/**
 * AppCoreModule aggregates all core infrastructure modules.
 * This keeps AppModule clean and allows reuse across workers or CLI tools.
 *
 * All infrastructure modules are exported so they can be used by feature modules.
 */
@Global()
@Module({
  imports: [
    // Configuration with Zod validation
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        queueConfig,
        memoryCompressionConfig,
        contextBuilderConfig,
      ],
      envFilePath: [".env.local", ".env"],
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
  exports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    CacheConfigModule,
    QueueModule,
  ],
})
export class AppCoreModule {}
