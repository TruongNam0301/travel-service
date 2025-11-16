import { registerAs } from "@nestjs/config";
import {
  MEMORY_COMPRESSION_PRESERVE_RECENT_COUNT_DEFAULT,
  MEMORY_COMPRESSION_MIN_EMBEDDINGS_THRESHOLD_DEFAULT,
  MEMORY_COMPRESSION_ACTIVE_CONVERSATION_DAYS_DEFAULT,
} from "../shared/constants/memory-compression.constant";

export default registerAs("memoryCompression", () => ({
  enabled:
    process.env.MEMORY_COMPRESSION_ENABLED === "true" ||
    process.env.MEMORY_COMPRESSION_ENABLED === undefined,
  interval: process.env.MEMORY_COMPRESSION_INTERVAL || "0 2 * * *", // Daily at 2 AM
  archiveThreshold: parseInt(
    process.env.MEMORY_ARCHIVE_THRESHOLD || "1000",
    10,
  ),
  defaultMode: (process.env.MEMORY_COMPRESSION_DEFAULT_MODE || "light") as
    | "light"
    | "full",
  inactivePlanDays: parseInt(process.env.MEMORY_INACTIVE_PLAN_DAYS || "30", 10),
  minEmbeddingsThreshold: parseInt(
    process.env.MEMORY_COMPRESSION_MIN_EMBEDDINGS_THRESHOLD ||
      String(MEMORY_COMPRESSION_MIN_EMBEDDINGS_THRESHOLD_DEFAULT),
    10,
  ),
  preserveRecentCount: parseInt(
    process.env.MEMORY_COMPRESSION_PRESERVE_RECENT_COUNT ||
      String(MEMORY_COMPRESSION_PRESERVE_RECENT_COUNT_DEFAULT),
    10,
  ),
  activeConversationDays: parseInt(
    process.env.MEMORY_COMPRESSION_ACTIVE_CONVERSATION_DAYS ||
      String(MEMORY_COMPRESSION_ACTIVE_CONVERSATION_DAYS_DEFAULT),
    10,
  ),
}));
