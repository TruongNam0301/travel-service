import { IsOptional, IsString, IsIn } from "class-validator";
import { BasePaginationDto } from "../../common/dto/base-pagination.dto";
import { JobState } from "../../entities/job.entity";

export class QueryJobsDto extends BasePaginationDto {
  @IsOptional()
  @IsString()
  @IsIn([
    JobState.QUEUED,
    JobState.PENDING,
    JobState.PROCESSING,
    JobState.RETRYING,
    JobState.COMPLETED,
    JobState.FAILED,
    JobState.CANCELLED,
  ])
  state?: JobState;

  @IsOptional()
  @IsString()
  type?: string;
}
