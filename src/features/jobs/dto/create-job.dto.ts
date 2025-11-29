import {
  IsString,
  IsOptional,
  IsObject,
  IsInt,
  Min,
  Max,
} from "class-validator";

export class CreateJobDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  priority?: number = 0;
}
