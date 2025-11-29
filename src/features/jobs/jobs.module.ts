import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Job } from "./entities/job.entity";
import { Plan } from "../plans/entities/plan.entity";
import { JobsService } from "./jobs.service";
import { JobTypesService } from "./job-types.service";
import { PlansModule } from "../plans/plans.module";
import { QueueModule } from "../../infrastructure/queue/queue.module";
import { JobProcessor } from "../../infrastructure/queue/processors/job.processor";
import { LlmModule } from "../../infrastructure/llm/llm.module";
import { PromptTemplatesModule } from "../../domain/prompt-templates/prompt-templates.module";
import { MemoryCompressionModule } from "../../domain/memory-compression/memory-compression.module";
import { ContextBuildersModule } from "../../domain/context-builders/context-builders.module";
import { MessagesModule } from "../messages/messages.module";
import { GoogleMapsModule } from "../../infrastructure/google-maps/google-maps.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, Plan]),
    forwardRef(() => PlansModule),
    QueueModule,
    LlmModule,
    PromptTemplatesModule,
    forwardRef(() => MemoryCompressionModule),
    ContextBuildersModule,
    forwardRef(() => MessagesModule),
    GoogleMapsModule,
  ],
  providers: [JobsService, JobTypesService, JobProcessor],
  exports: [JobsService],
})
export class JobsModule {}
