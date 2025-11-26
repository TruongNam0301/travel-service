import { registerAs } from "@nestjs/config";
import {
  MEMORY_COMPRESSION_PRESERVE_RECENT_COUNT_DEFAULT,
  MEMORY_COMPRESSION_MIN_EMBEDDINGS_THRESHOLD_DEFAULT,
  MEMORY_COMPRESSION_ACTIVE_CONVERSATION_DAYS_DEFAULT,
} from "../shared/constants/memory-compression.constant";

export default registerAs("memoryCompression", () => ({
  enabled: true,
  interval: "0 2 * * *", // Daily at 2 AM
  archiveThreshold: 1000,
  defaultMode: "light" as "light" | "full",
  inactivePlanDays: 30,
  minEmbeddingsThreshold: MEMORY_COMPRESSION_MIN_EMBEDDINGS_THRESHOLD_DEFAULT,
  preserveRecentCount: MEMORY_COMPRESSION_PRESERVE_RECENT_COUNT_DEFAULT,
  activeConversationDays: MEMORY_COMPRESSION_ACTIVE_CONVERSATION_DAYS_DEFAULT,
}));
