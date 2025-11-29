/**
 * Context Builder Constants
 * Configuration constants for memory context builders
 */

/**
 * Default maximum tokens for context building
 */
export const CONTEXT_BUILDER_MAX_TOKENS_DEFAULT = 8000;

/**
 * Default message limit for conversation context
 */
export const CONTEXT_BUILDER_MESSAGE_LIMIT_DEFAULT = 20;

/**
 * Default top-k for embedding retrieval
 */
export const CONTEXT_BUILDER_EMBEDDING_TOP_K_DEFAULT = 10;

/**
 * Default similarity threshold for embeddings (0-1)
 */
export const CONTEXT_BUILDER_EMBEDDING_THRESHOLD_DEFAULT = 0.7;

/**
 * Default job limit for plan context
 */
export const CONTEXT_BUILDER_JOB_LIMIT_DEFAULT = 5;

/**
 * Default token threshold for long message summarization
 */
export const CONTEXT_BUILDER_LONG_MESSAGE_THRESHOLD_DEFAULT = 500;

/**
 * Default token budget allocation (as percentages)
 */
export const CONTEXT_BUILDER_TOKEN_BUDGET_DEFAULT = {
  messages: 0.5, // 50% for messages
  embeddings: 0.35, // 35% for embeddings
  plan: 0.15, // 15% for plan metadata
};

/**
 * Minimum token counts for each context type
 */
export const CONTEXT_BUILDER_MIN_TOKENS = {
  messages: 100,
  embeddings: 50,
  plan: 50,
};

/**
 * Maximum token counts for each context type (safety limits)
 */
export const CONTEXT_BUILDER_MAX_TOKENS = {
  messages: 4000,
  embeddings: 3000,
  plan: 2000,
};
