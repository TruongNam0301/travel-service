import { registerAs } from "@nestjs/config";
import { QueueOptions } from "bullmq";

export default registerAs(
  "queue",
  (): QueueOptions => ({
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100,
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
  }),
);

export const getQueueConcurrency = (): number => {
  return parseInt(process.env.QUEUE_CONCURRENCY || "5", 10);
};
