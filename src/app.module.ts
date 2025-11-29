import { Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { AppCoreModule } from "./core/app-core.module";
import { HealthModule } from "./health/health.module";
import { GlobalExceptionFilter } from "./core/exceptions/exception.filter";
import { TransformInterceptor } from "./core/interceptors";
import { UsersModule } from "./features/users/users.module";
import { AuthModule } from "./features/auth/auth.module";
import { PlansModule } from "./features/plans/plans.module";
import { JobsModule } from "./features/jobs/jobs.module";
import { ConversationsModule } from "./features/conversations/conversations.module";
import { MessagesModule } from "./features/messages/messages.module";
import { LlmModule } from "./infrastructure/llm/llm.module";
import { PromptTemplatesModule } from "./domain/prompt-templates/prompt-templates.module";
import { EmbeddingsModule } from "./features/embeddings/embeddings.module";
import { MemoryCompressionModule } from "./domain/memory-compression/memory-compression.module";
import { ContextBuildersModule } from "./domain/context-builders/context-builders.module";
import { GoogleMapsModule } from "./infrastructure/google-maps/google-maps.module";
import appConfig from "./config/app.config";

@Module({
  imports: [
    AppCoreModule,
    ThrottlerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (appCfg: ConfigType<typeof appConfig>) => ({
        throttlers: [
          {
            ttl: appCfg.rateLimit.ttl * 1000, // Convert to ms
            limit: appCfg.rateLimit.max,
          },
        ],
      }),
    }),

    HealthModule,
    UsersModule,
    AuthModule,
    PlansModule,
    JobsModule,
    ConversationsModule,
    MessagesModule,
    LlmModule,
    PromptTemplatesModule,
    EmbeddingsModule,
    MemoryCompressionModule,
    ContextBuildersModule,
    GoogleMapsModule,
  ],
  providers: [
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Global response transformer
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
