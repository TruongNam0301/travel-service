import {
  IsEmail,
  IsString,
  IsOptional,
  IsObject,
  MinLength,
} from "class-validator";
import { UserRole, UserStatus } from "../entities/user.entity";

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  passwordHash: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsOptional()
  @IsString()
  role?: UserRole;

  @IsOptional()
  @IsString()
  status?: UserStatus;
}
