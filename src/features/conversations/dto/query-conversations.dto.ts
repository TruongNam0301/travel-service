import { IsOptional, IsBoolean } from "class-validator";
import { Type } from "class-transformer";
import { BasePaginationDto } from "../../../core/dto/base-pagination.dto";

export class QueryConversationsDto extends BasePaginationDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean = false;

  // Override default sort to lastMessageAt DESC
  sortBy?: string = "lastMessageAt";
  sortOrder?: "ASC" | "DESC" = "DESC";
}
