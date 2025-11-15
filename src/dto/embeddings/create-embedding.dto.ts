import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";

export class CreateEmbeddingDto {
  @IsString()
  @IsNotEmpty({ message: "Text is required" })
  @MinLength(1, { message: "Text cannot be empty" })
  @MaxLength(200000, { message: "Text cannot exceed 200,000 characters" })
  @Transform(({ value }: { value: string }) =>
    typeof value === "string" ? value.trim() : value,
  )
  text!: string;

  @IsString()
  @IsNotEmpty({ message: "Plan ID is required" })
  @IsUUID("4", { message: "Plan ID must be a valid UUID" })
  planId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "Ref type cannot exceed 50 characters" })
  refType?: string;

  @IsOptional()
  @IsString()
  @IsUUID("4", { message: "Ref ID must be a valid UUID" })
  refId?: string;
}
