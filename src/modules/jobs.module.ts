import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Job } from "../entities/job.entity";
import { Plan } from "../entities/plan.entity";
import { JobsService } from "../services/jobs.service";
import { JobTypesService } from "../services/job-types.service";
import { JobsController } from "../controllers/jobs.controller";
import { PlansModule } from "./plans.module";
import { QueueModule } from "../queue/queue.module";
import { JobProcessor } from "../queue/job.processor";
import { LlmModule } from "./llm.module";
import { PromptTemplatesModule } from "./prompt-templates.module";
import { MemoryCompressionModule } from "./memory-compression.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, Plan]),
    PlansModule,
    QueueModule,
    LlmModule,
    PromptTemplatesModule,
    MemoryCompressionModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, JobTypesService, JobProcessor],
  exports: [JobsService],
})
export class JobsModule {}
