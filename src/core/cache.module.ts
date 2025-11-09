import { Module, OnApplicationShutdown, Global, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import type { RedisClientOptions } from 'redis';

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

@Global()
@Module({
  imports: [
    CacheModule.registerAsync<RedisClientOptions>({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisConfig = configService.get<RedisConfig>('redis')!;
        return {
          store: redisStore,
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          ttl: 300, // 5 minutes default
          max: 100,
          isGlobal: true,
        };
      },
      isGlobal: true,
    }),
  ],
  exports: [CacheModule],
})
export class CacheConfigModule implements OnApplicationShutdown {
  private readonly logger = new Logger(CacheConfigModule.name);

  onApplicationShutdown(signal?: string): void {
    this.logger.log(`Closing cache connections... (signal: ${signal})`);
    this.logger.log('Cache connections closed');
  }
}
