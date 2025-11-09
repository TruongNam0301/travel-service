import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { AppCoreModule } from './core/app-core.module';
import { HealthModule } from './health/health.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/exceptions';

@Module({
  imports: [
    // Core infrastructure modules (Config, Logger, Database, Cache, Queue)
    AppCoreModule,

    // Rate limiting with Redis storage
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('RATE_LIMIT_TTL', 60) * 1000, // Convert to ms
            limit: configService.get<number>('RATE_LIMIT_MAX', 100),
          },
        ],
        // Future: Add Redis storage for distributed rate limiting
        // storage: new ThrottlerStorageRedisService(redis),
      }),
    }),

    // Health check endpoints
    HealthModule,

    // Future feature modules will be imported here
    // Example: UsersModule, PlansModule, etc.
  ],
  providers: [
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
