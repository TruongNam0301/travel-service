import { IsOptional, IsObject } from "class-validator";

export class UpdateJobDto {
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}
