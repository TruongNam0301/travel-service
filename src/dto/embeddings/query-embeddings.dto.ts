import {
  IsOptional,
  IsBoolean,
  IsString,
  IsEnum,
  IsArray,
  IsISO8601,
  MaxLength,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { BasePaginationDto } from "../../common/dto/base-pagination.dto";

export class QueryEmbeddingsDto extends BasePaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "Ref type cannot exceed 50 characters" })
  refType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }): string[] => {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === "string") return [value];
    return [];
  })
  refTypes?: string[];

  @IsOptional()
  @IsISO8601()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @IsISO8601()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean = false;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeVector?: boolean = false;

  // Override default sort to createdAt DESC
  @IsOptional()
  @IsEnum(["createdAt", "updatedAt", "id"])
  sortBy?: "createdAt" | "updatedAt" | "id" = "createdAt";

  @IsOptional()
  @IsEnum(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC" = "DESC";
}
