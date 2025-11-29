import { IsEnum, IsOptional, IsBoolean } from "class-validator";
import * as memoryCompressionType from "../../../core/types/memory-compression.type";

export class CompressMemoryDto {
  @IsEnum(["light", "full"])
  mode: memoryCompressionType.MemoryCompressionMode;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
