import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Embedding } from "../entities/embedding.entity";
import { Plan } from "../entities/plan.entity";
import { Conversation } from "../entities/conversation.entity";
import { Job } from "../entities/job.entity";
import { MemoryCompressionService } from "../services/memory-compression.service";
import { MemoryCompressionSchedulerService } from "../services/memory-compression-scheduler.service";
import { PlansModule } from "./plans.module";
import { EmbeddingsModule } from "./embeddings.module";
import { LlmModule } from "./llm.module";
import { JobsModule } from "./jobs.module";

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
