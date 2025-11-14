import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PromptTemplate } from "../entities/prompt-template.entity";
import { JobType } from "../entities/job-type.entity";
import { PromptTemplatesService } from "../services/prompt-templates.service";

@Module({
  imports: [TypeOrmModule.forFeature([PromptTemplate, JobType])],
  providers: [PromptTemplatesService],
  exports: [PromptTemplatesService],
})
export class PromptTemplatesModule {}
