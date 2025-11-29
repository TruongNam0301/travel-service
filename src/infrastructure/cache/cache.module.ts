import { Module, OnApplicationShutdown, Global, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import { redisStore } from "cache-manager-redis-store";
import type { RedisClientOptions } from "redis";
import redisConfig, { getCacheConfig } from "../../config/redis.config";

@Global()
@Module({
  imports: [
    CacheModule.registerAsync<RedisClientOptions>({
      inject: [redisConfig.KEY],
      useFactory: (redisCfg: ConfigType<typeof redisConfig>) => {
        const cacheCfg = getCacheConfig();
        return {
          store: redisStore,
          host: redisCfg.host,
          port: redisCfg.port,
          password: redisCfg.password,
          ttl: cacheCfg.ttl,
          max: cacheCfg.max,
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
    this.logger.log("Cache connections closed");
  }
}
