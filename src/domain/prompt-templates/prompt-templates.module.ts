import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PromptTemplate } from "./entities/prompt-template.entity";
import { JobType } from "../../features/jobs/entities/job-type.entity";
import { PromptTemplatesService } from "./prompt-templates.service";

@Module({
  imports: [TypeOrmModule.forFeature([PromptTemplate, JobType])],
  providers: [PromptTemplatesService],
  exports: [PromptTemplatesService],
})
export class PromptTemplatesModule {}
