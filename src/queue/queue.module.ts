import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { QueueService } from "./queue.service";
import { QueueOptions } from "bullmq";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const queueConfig = configService.get<QueueOptions>("queue")!;
        return {
          connection: queueConfig.connection,
          defaultJobOptions: queueConfig.defaultJobOptions,
        };
      },
    }),
    // Register research-jobs queue
    BullModule.registerQueue({ name: "research-jobs" }),
  ],
  providers: [QueueService],
  exports: [BullModule, QueueService],
})
export class QueueModule {}
