import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Job } from "../entities/job.entity";
import { Plan } from "../entities/plan.entity";
import { JobsService } from "../services/jobs.service";
import { JobsController } from "../controllers/jobs.controller";
import { PlansModule } from "./plans.module";
import { QueueModule } from "../queue/queue.module";
import { JobProcessor } from "../queue/job.processor";

@Module({
  imports: [TypeOrmModule.forFeature([Job, Plan]), PlansModule, QueueModule],
  controllers: [JobsController],
  providers: [JobsService, JobProcessor],
  exports: [JobsService],
})
export class JobsModule {}
