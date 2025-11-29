import { registerAs } from "@nestjs/config";
import { RedisOptions } from "ioredis";

export interface RedisConfig extends RedisOptions {
  host: string;
  port: number;
  password?: string;
}

export interface CacheConfig {
  ttl: number;
  max: number;
  isGlobal: boolean;
}

export default registerAs(
  "redis",
  (): RedisConfig => ({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times: number) => {
      // Reconnect after a delay
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  }),
);

export const getCacheConfig = (): CacheConfig => ({
  ttl: parseInt(process.env.CACHE_TTL || "300", 10),
  max: parseInt(process.env.CACHE_MAX || "100", 10),
  isGlobal: true,
});

export const REDIS_CONFIG_KEY = "redis";
