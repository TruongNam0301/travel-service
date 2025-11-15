/**
 * Memory Compression Constants
 * Configuration constants and thresholds for memory compression strategy
 */

/**
 * Available compression modes
 */
export const MEMORY_COMPRESSION_MODES = ["light", "full"] as const;

/**
 * Default similarity threshold for clustering embeddings
 * Embeddings with cosine similarity >= this threshold will be considered for clustering
 */
export const MEMORY_COMPRESSION_SIMILARITY_THRESHOLD = 0.95;

/**
 * Duplicate detection threshold
 * Embeddings with cosine similarity >= this threshold are considered duplicates
 */
export const MEMORY_COMPRESSION_DUPLICATE_THRESHOLD = 0.97;

/**
 * Retention policy duration in days
 * Embeddings older than this will be considered for archival
 */
export const MEMORY_COMPRESSION_RETENTION_DAYS = 90;

/**
 * Minimum cluster size required for merging
 * Clusters with fewer than this many embeddings will not be merged
 */
export const MEMORY_COMPRESSION_MIN_CLUSTER_SIZE = 2;

/**
 * Maximum cluster size for merging
 * Clusters larger than this will be split or processed differently
 */
export const MEMORY_COMPRESSION_MAX_CLUSTER_SIZE = 50;

/**
 * Minimum age in days before embeddings can be clustered
 * Embeddings newer than this will never be clustered (kept fresh)
 */
export const MEMORY_COMPRESSION_MIN_AGE_DAYS = 14;

/**
 * Low-value threshold in days
 * Embeddings with no usage for this many days are considered low-value
 */
export const MEMORY_COMPRESSION_LOW_VALUE_DAYS = 30;

/**
 * Number of most recent embeddings to always preserve (never compress)
 * This ensures recent context is never lost
 */
export const MEMORY_COMPRESSION_PRESERVE_RECENT_COUNT = 20;

/**
 * Minimum cluster size to generate LLM summary
 * Clusters smaller than this will use concatenation instead
 */
export const MEMORY_COMPRESSION_MIN_CLUSTER_SIZE_FOR_SUMMARY = 3;

/**
 * Maximum number of clusters to process in parallel
 * Helps with performance for large memory sets (>5k embeddings)
 */
export const MEMORY_COMPRESSION_PARALLEL_CLUSTER_BATCH_SIZE = 5;

/**
 * Clustering Algorithm Specification
 *
 * Approach: KNN + threshold grouping (recommended over K-means for efficiency)
 *
 * Input:
 *   - Embeddings within the same plan
 *   - Only embeddings older than MEMORY_COMPRESSION_MIN_AGE_DAYS (14 days)
 *
 * Output:
 *   - Clusters of similar vectors
 *   - Each cluster contains embeddings with cosine similarity >= threshold
 *
 * Similarity Rule:
 *   - Cosine similarity >= MEMORY_COMPRESSION_SIMILARITY_THRESHOLD (0.95)
 *
 * Special Rules:
 *   - Never cluster embeddings < 14 days old (keep fresh embeddings separate)
 *   - Clusters with size < MIN_CLUSTER_SIZE (2) are not merged
 *   - Clusters with size > MAX_CLUSTER_SIZE (50) may need splitting
 *
 * Fallback Behavior:
 *   - When cluster size = 1: Keep the embedding as-is (no merging needed)
 *   - When no similar embeddings found: Keep embedding as-is
 */
