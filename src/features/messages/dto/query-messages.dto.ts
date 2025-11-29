import { BasePaginationDto } from "../../../core/dto/base-pagination.dto";

export class QueryMessagesDto extends BasePaginationDto {
  // Override default sort to createdAt ASC for chronological message display
  sortBy?: string = "createdAt";
  sortOrder?: "ASC" | "DESC" = "ASC";
}
