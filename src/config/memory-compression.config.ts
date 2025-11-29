import { registerAs } from "@nestjs/config";

export type CompressionMode = "light" | "aggressive" | "full";

export interface MemoryCompressionConfig {
  enabled: boolean;
  interval: string;
  archiveThreshold: number;
  defaultMode: CompressionMode;
  inactivePlanDays: number;
  minEmbeddingsThreshold: number;
  preserveRecentCount: number;
  activeConversationDays: number;
}

export default registerAs(
  "memoryCompression",
  (): MemoryCompressionConfig => ({
    enabled:
      process.env.MEMORY_COMPRESSION_ENABLED === "true" ||
      process.env.MEMORY_COMPRESSION_ENABLED === undefined,
    interval: "0 2 * * *", // 2 AM daily
    archiveThreshold: parseInt(
      process.env.MEMORY_COMPRESSION_ARCHIVE_THRESHOLD || "1000",
      10,
    ),
    defaultMode:
      (process.env.MEMORY_COMPRESSION_DEFAULT_MODE as CompressionMode) ||
      "light",
    inactivePlanDays: parseInt(
      process.env.MEMORY_COMPRESSION_INACTIVE_PLAN_DAYS || "30",
      10,
    ),
    minEmbeddingsThreshold: parseInt(
      process.env.MEMORY_COMPRESSION_MIN_EMBEDDINGS_THRESHOLD || "50",
      10,
    ),
    preserveRecentCount: parseInt(
      process.env.MEMORY_COMPRESSION_PRESERVE_RECENT_COUNT || "20",
      10,
    ),
    activeConversationDays: parseInt(
      process.env.MEMORY_COMPRESSION_ACTIVE_CONVERSATION_DAYS || "7",
      10,
    ),
  }),
);

export const MEMORY_COMPRESSION_CONFIG_KEY = "memoryCompression";
