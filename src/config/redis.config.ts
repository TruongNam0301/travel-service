import { registerAs } from "@nestjs/config";
import { RedisOptions } from "ioredis";

export default registerAs(
  "redis",
  (): RedisOptions => ({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times: number) => {
      // Reconnect after a delay
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  }),
);

export const getCacheConfig = () => ({
  ttl: 300, // 5 minutes default
  max: 100, // maximum number of items in cache
  isGlobal: true,
});
