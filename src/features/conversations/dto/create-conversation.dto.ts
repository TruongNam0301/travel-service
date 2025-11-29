import { IsString, IsOptional, MaxLength, IsBoolean } from "class-validator";

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: "Title cannot exceed 255 characters" })
  title?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
