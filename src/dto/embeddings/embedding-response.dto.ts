import { Exclude, Expose } from "class-transformer";

/**
 * Response DTO for Embedding entity
 * Excludes vector field by default for security and performance
 */
export class EmbeddingResponseDto {
  @Expose()
  id!: string;

  @Expose()
  planId!: string;

  @Expose()
  refType!: string;

  @Expose()
  refId!: string | null;

  @Expose()
  content!: string;

  @Expose()
  isDeleted!: boolean;

  @Expose()
  deletedAt?: Date;

  @Expose()
  deletedBy?: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  // Vector is excluded by default
  // Use includeVector flag in query to include it
  @Exclude()
  vector?: number[];
}
