/**
 * Context Builder Configuration
 * Environment-based configuration for memory context builders
 */

import { registerAs } from "@nestjs/config";
import {
  CONTEXT_BUILDER_MAX_TOKENS_DEFAULT,
  CONTEXT_BUILDER_MESSAGE_LIMIT_DEFAULT,
  CONTEXT_BUILDER_EMBEDDING_TOP_K_DEFAULT,
  CONTEXT_BUILDER_EMBEDDING_THRESHOLD_DEFAULT,
  CONTEXT_BUILDER_JOB_LIMIT_DEFAULT,
  CONTEXT_BUILDER_LONG_MESSAGE_THRESHOLD_DEFAULT,
} from "../shared/constants/context-builder.constant";

export default registerAs("contextBuilder", () => ({
  maxTokens:
    parseInt(
      process.env.CONTEXT_BUILDER_MAX_TOKENS ||
        String(CONTEXT_BUILDER_MAX_TOKENS_DEFAULT),
      10,
    ) ?? CONTEXT_BUILDER_MAX_TOKENS_DEFAULT,
  messageLimit:
    parseInt(
      process.env.CONTEXT_BUILDER_MESSAGE_LIMIT ||
        String(CONTEXT_BUILDER_MESSAGE_LIMIT_DEFAULT),
      10,
    ) ?? CONTEXT_BUILDER_MESSAGE_LIMIT_DEFAULT,
  embeddingTopK:
    parseInt(
      process.env.CONTEXT_BUILDER_EMBEDDING_TOP_K ||
        String(CONTEXT_BUILDER_EMBEDDING_TOP_K_DEFAULT),
      10,
    ) ?? CONTEXT_BUILDER_EMBEDDING_TOP_K_DEFAULT,
  embeddingThreshold:
    parseFloat(
      process.env.CONTEXT_BUILDER_EMBEDDING_THRESHOLD ||
        String(CONTEXT_BUILDER_EMBEDDING_THRESHOLD_DEFAULT),
    ) ?? CONTEXT_BUILDER_EMBEDDING_THRESHOLD_DEFAULT,
  jobLimit:
    parseInt(
      process.env.CONTEXT_BUILDER_JOB_LIMIT ||
        String(CONTEXT_BUILDER_JOB_LIMIT_DEFAULT),
      10,
    ) ?? CONTEXT_BUILDER_JOB_LIMIT_DEFAULT,
  longMessageThreshold:
    parseInt(
      process.env.CONTEXT_BUILDER_LONG_MESSAGE_THRESHOLD ||
        String(CONTEXT_BUILDER_LONG_MESSAGE_THRESHOLD_DEFAULT),
      10,
    ) ?? CONTEXT_BUILDER_LONG_MESSAGE_THRESHOLD_DEFAULT,
}));

export type ContextBuilderConfig = {
  maxTokens: number;
  messageLimit: number;
  embeddingTopK: number;
  embeddingThreshold: number;
  jobLimit: number;
  longMessageThreshold: number;
};
