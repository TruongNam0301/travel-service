import { IsOptional, IsInt, Min, Max, IsIn } from "class-validator";
import { Type } from "class-transformer";

/**
 * Base Pagination DTO
 * Standard pagination query parameters
 */
export class BasePaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  sortBy?: string;

  @IsOptional()
  @IsIn(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC" = "DESC";
}
