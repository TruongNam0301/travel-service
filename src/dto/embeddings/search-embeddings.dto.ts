import {
  IsInt,
  IsOptional,
  IsArray,
  IsISO8601,
  IsNumber,
  Min,
  Max,
  IsString,
  IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";

export class SearchEmbeddingsDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  topK?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  refTypes?: string[];

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;
}
