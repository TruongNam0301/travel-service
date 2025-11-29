/**
 * Context Builder Configuration
 * Environment-based configuration for memory context builders
 */

import { registerAs } from "@nestjs/config";

export interface ContextBuilderConfig {
  maxTokens: number;
  messageLimit: number;
  embeddingTopK: number;
  embeddingThreshold: number;
  jobLimit: number;
  longMessageThreshold: number;
}

export default registerAs(
  "contextBuilder",
  (): ContextBuilderConfig => ({
    maxTokens: parseInt(process.env.CONTEXT_BUILDER_MAX_TOKENS || "8000", 10),
    messageLimit: parseInt(
      process.env.CONTEXT_BUILDER_MESSAGE_LIMIT || "30",
      10,
    ),
    embeddingTopK: parseInt(
      process.env.CONTEXT_BUILDER_EMBEDDING_TOP_K || "10",
      10,
    ),
    embeddingThreshold: parseFloat(
      process.env.CONTEXT_BUILDER_EMBEDDING_THRESHOLD || "0.7",
    ),
    jobLimit: parseInt(process.env.CONTEXT_BUILDER_JOB_LIMIT || "5", 10),
    longMessageThreshold: parseInt(
      process.env.CONTEXT_BUILDER_LONG_MESSAGE_THRESHOLD || "1000",
      10,
    ),
  }),
);

export const CONTEXT_BUILDER_CONFIG_KEY = "contextBuilder";
