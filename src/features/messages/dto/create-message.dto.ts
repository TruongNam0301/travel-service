import { IsString, IsNotEmpty, MinLength, MaxLength } from "class-validator";
import { Transform } from "class-transformer";

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty({ message: "Content is required" })
  @MinLength(1, { message: "Content cannot be empty" })
  @MaxLength(10000, { message: "Content cannot exceed 10,000 characters" })
  @Transform(({ value }: { value: string }) =>
    typeof value === "string" ? value.trim() : value,
  )
  content: string;
}
