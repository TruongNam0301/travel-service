import { IsString, IsNotEmpty, MaxLength } from "class-validator";

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000, {
    message: "Message content cannot exceed 10,000 characters",
  })
  content: string;
}
