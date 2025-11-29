/**
 * Context Builder Types
 * Type definitions for memory context builders
 */

import { Message } from "../../features/messages/entities/message.entity";
import { Job } from "../../features/jobs/entities/job.entity";
import { Plan } from "../../features/plans/entities/plan.entity";

/**
 * Options for building conversation context
 */
export interface ConversationContextOptions {
  limit?: number; // Max number of messages to include
  maxTokens?: number; // Max tokens for conversation context
  includeSummaries?: boolean; // Whether to summarize long messages
  longMessageThreshold?: number; // Token threshold for summarizing messages
}

/**
 * Conversation context result
 */
export interface ConversationContext {
  messages: Message[];
  formatted: string; // Formatted string for LLM
  tokenCount: number;
  truncated: boolean; // Whether messages were truncated
  summary?: string; // Optional summary of truncated messages
}

/**
 * Options for building plan context
 */
export interface PlanContextOptions {
  includeMetadata?: boolean;
  includeJobs?: boolean;
  jobLimit?: number;
  includeEmbeddingsSummary?: boolean;
  maxTokens?: number;
}

/**
 * Plan context result
 */
export interface PlanContext {
  plan: Plan;
  metadata?: Record<string, any>;
  recentJobs?: Job[];
  embeddingsSummary?: {
    total: number;
    active: number;
    archived: number;
    lastCompression?: {
      mode: string;
      ratio: number;
      timestamp: Date;
    };
  };
  formatted: string; // Formatted string for LLM
  tokenCount: number;
}

/**
 * Options for building embedding context
 */
export interface EmbeddingContextOptions {
  topK?: number; // Number of embeddings to retrieve
  threshold?: number; // Similarity threshold (0-1)
  maxTokens?: number; // Max tokens for embedding context
  query?: string; // Optional query for semantic search
}

/**
 * Embedding context result
 */
export interface EmbeddingContext {
  embeddings: Array<{
    id: string;
    content: string;
    similarity: number;
    refType: string;
    refId: string | null;
    createdAt: Date;
  }>;
  formatted: string; // Formatted string for LLM
  tokenCount: number;
  query?: string;
}

/**
 * Options for final context composition
 */
export interface FinalContextOptions {
  planId: string;
  conversationId?: string;
  query?: string; // Optional query for embedding search
  maxTokens?: number; // Total token budget
  priorities?: {
    messages?: number; // Token budget for messages
    embeddings?: number; // Token budget for embeddings
    plan?: number; // Token budget for plan
  };
  includeConversation?: boolean;
  includeEmbeddings?: boolean;
  includePlan?: boolean;
}

/**
 * Final composed context
 */
export interface FinalContext {
  conversation?: ConversationContext;
  plan?: PlanContext;
  embeddings?: EmbeddingContext;
  formatted: string; // Final formatted prompt
  tokenCount: number;
  breakdown: {
    conversation: number;
    plan: number;
    embeddings: number;
  };
}

/**
 * Context builder error
 */
export class ContextBuilderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = "ContextBuilderError";
  }
}
