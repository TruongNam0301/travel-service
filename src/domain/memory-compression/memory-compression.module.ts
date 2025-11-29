import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Embedding } from "../../features/embeddings/entities/embedding.entity";
import { Plan } from "../../features/plans/entities/plan.entity";
import { Conversation } from "../../features/conversations/entities/conversation.entity";
import { Job } from "../../features/jobs/entities/job.entity";
import { MemoryCompressionService } from "./memory-compression.service";
import { MemoryCompressionSchedulerService } from "./memory-compression-scheduler.service";
import { PlansModule } from "../../features/plans/plans.module";
import { EmbeddingsModule } from "../../features/embeddings/embeddings.module";
import { LlmModule } from "../../infrastructure/llm/llm.module";
import { JobsModule } from "../../features/jobs/jobs.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Embedding, Plan, Conversation, Job]),
    forwardRef(() => PlansModule),
    EmbeddingsModule,
    LlmModule,
    forwardRef(() => JobsModule),
  ],
  providers: [MemoryCompressionService, MemoryCompressionSchedulerService],
  exports: [MemoryCompressionService, MemoryCompressionSchedulerService],
})
export class MemoryCompressionModule {}
