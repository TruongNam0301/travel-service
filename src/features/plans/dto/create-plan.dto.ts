import { IsString, IsOptional, IsObject, MinLength } from "class-validator";

export class CreatePlanDto {
  @IsString()
  @MinLength(1, { message: "Title is required" })
  title: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
