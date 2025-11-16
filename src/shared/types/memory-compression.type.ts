/**
 * Memory Compression Types
 * Type definitions for memory compression strategy
 */

import { Embedding } from "../../entities/embedding.entity";

/**
 * Compression mode for memory compression operations
 * - "light": Deduplication only (remove duplicate embeddings)
 * - "full": Full compression (cluster + merge + archive)
 */
export type MemoryCompressionMode = "light" | "full";

/**
 * Result of a memory compression operation
 */
export interface CompressionResult {
  planId: string;
  mode: MemoryCompressionMode;
  beforeCount: number;
  afterCount: number;
  compressionRatio: number;
  duplicatesRemoved?: number;
  clustersMerged?: number;
  embeddingsArchived?: number;
  durationMs: number;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Cluster of similar embeddings
 */
export interface EmbeddingCluster {
  embeddings: Embedding[];
  similarity: number; // cluster-level similarity metric
}

/**
 * Options for memory compression
 */
export interface CompressionOptions {
  dryRun?: boolean; // If true, log operations but don't make changes
}

/**
 * Cached embedding vector for in-memory similarity calculations
 */
export interface CachedEmbeddingVector {
  id: string;
  vector: number[];
  embedding: Embedding;
}

/**
 * Memory compression diagnostics for a plan
 */
export interface CompressionDiagnostics {
  planId: string;
  totalEmbeddings: number;
  eligibleEmbeddings: number;
  preservedEmbeddings: number;
  duplicateGroups: number;
  potentialClusters: number;
  estimatedCompressionRatio: number;
  lastCompression?: {
    mode: MemoryCompressionMode;
    beforeCount: number;
    afterCount: number;
    compressionRatio: number;
    timestamp: Date;
  };
}

/**
 * Memory statistics for a plan
 * Includes current state and last compression history
 */
export interface MemoryStats {
  planId: string;
  totalEmbeddings: number;
  archivedEmbeddings: number;
  activeEmbeddings: number;
  lastCompression?: {
    mode: MemoryCompressionMode;
    beforeCount: number;
    afterCount: number;
    compressionRatio: number;
    duplicatesRemoved?: number;
    clustersMerged?: number;
    embeddingsArchived?: number;
    durationMs: number;
    timestamp: Date;
  };
}
