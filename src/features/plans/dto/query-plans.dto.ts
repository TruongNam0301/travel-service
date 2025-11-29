import { IsOptional, IsBoolean, IsString } from "class-validator";
import { Type } from "class-transformer";
import { BasePaginationDto } from "../../../core/dto/base-pagination.dto";

export class QueryPlansDto extends BasePaginationDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean = false;

  @IsOptional()
  @IsString()
  search?: string;
}
