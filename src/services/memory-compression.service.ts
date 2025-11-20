import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Embedding } from "../entities/embedding.entity";
import { Job, JobState } from "../entities/job.entity";
import { Conversation } from "../entities/conversation.entity";
import { PlansService } from "./plans.service";
import { LLM_CLIENT } from "../common/services/llm/llm.client";
import type { LlmClient } from "../common/services/llm/llm.client";
import {
  MemoryCompressionMode,
  CompressionResult,
  EmbeddingCluster,
  CompressionOptions,
  CachedEmbeddingVector,
  CompressionDiagnostics,
  MemoryStats,
} from "../shared/types/memory-compression.type";
import {
  MEMORY_COMPRESSION_SIMILARITY_THRESHOLD,
  MEMORY_COMPRESSION_DUPLICATE_THRESHOLD,
  MEMORY_COMPRESSION_MIN_CLUSTER_SIZE,
  MEMORY_COMPRESSION_MAX_CLUSTER_SIZE,
  MEMORY_COMPRESSION_MIN_AGE_DAYS,
  MEMORY_COMPRESSION_MIN_CLUSTER_SIZE_FOR_SUMMARY,
  MEMORY_COMPRESSION_PARALLEL_CLUSTER_BATCH_SIZE,
} from "../shared/constants/memory-compression.constant";
import memoryCompressionConfig from "../config/memory-compression.config";

@Injectable()
export class MemoryCompressionService {
  private readonly logger = new Logger(MemoryCompressionService.name);
  private readonly minEmbeddingsThreshold: number;
  private readonly preserveRecentCount: number;
  private readonly activeConversationDays: number;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Embedding)
    private readonly embeddingsRepo: Repository<Embedding>,
    @InjectRepository(Job)
    private readonly jobsRepo: Repository<Job>,
    @InjectRepository(Conversation)
    private readonly conversationsRepo: Repository<Conversation>,
    @Inject(forwardRef(() => PlansService))
    private readonly plansService: PlansService,
    private readonly configService: ConfigService,

    @Inject(LLM_CLIENT)
    private readonly llmClient: LlmClient,
  ) {
    const config =
      this.configService.get<ReturnType<typeof memoryCompressionConfig>>(
        "memoryCompression",
      );
    this.minEmbeddingsThreshold = config?.minEmbeddingsThreshold ?? 50;
    this.preserveRecentCount = config?.preserveRecentCount ?? 20;
    this.activeConversationDays = config?.activeConversationDays ?? 7;
  }

  /**
   * Compress plan memory based on mode
   */
  async compressPlanMemory(
    planId: string,
    mode: MemoryCompressionMode,
    userId?: string,
    options?: CompressionOptions,
  ): Promise<CompressionResult> {
    const startTime = Date.now();

    const dryRun = options?.dryRun ?? false;

    this.logger.log({
      action: "memory_compression.start",
      planId,
      mode,
      userId: userId ?? null,
      dryRun,
    });

    // Verify plan ownership if userId provided
    if (userId) {
      await this.plansService.verifyOwnership(planId, userId);
    }

    // Get initial embedding count
    const beforeCount = await this.embeddingsRepo.count({
      where: { planId, isDeleted: false },
    });

    this.logger.log({
      action: "memory_compression.initial_count",
      planId,
      mode,
      embeddingsBefore: beforeCount,
    });

    // Check minimum threshold
    if (beforeCount < this.minEmbeddingsThreshold) {
      const skipReason = `Embedding count (${beforeCount}) is below minimum threshold (${this.minEmbeddingsThreshold})`;
      this.logger.warn({
        action: "memory_compression.skipped",
        planId,
        mode,
        reason: skipReason,
        embeddingsBefore: beforeCount,
        threshold: this.minEmbeddingsThreshold,
      });

      const durationMs = Date.now() - startTime;
      return {
        planId,
        mode,
        beforeCount,
        afterCount: beforeCount,
        compressionRatio: 0,
        durationMs,
        skipped: true,
        skipReason,
      };
    }

    let duplicatesRemoved = 0;
    let clustersMerged = 0;
    let embeddingsArchived = 0;

    if (mode === "light") {
      // Light mode: duplicate removal only
      this.logger.log({
        action: "memory_compression.light_mode.start",
        planId,
        embeddingsBefore: beforeCount,
      });

      const duplicateGroups = await this.findRedundantEmbeddings(planId);
      const duplicateIds: string[] = [];

      for (const group of duplicateGroups) {
        // Keep the first one, mark others as duplicates
        if (group.length > 1) {
          duplicateIds.push(...group.slice(1));
        }
      }

      this.logger.log({
        action: "memory_compression.light_mode.duplicates_found",
        planId,
        duplicateGroups: duplicateGroups.length,
        duplicatesToRemove: duplicateIds.length,
      });

      if (duplicateIds.length > 0) {
        if (!dryRun) {
          await this.archiveEmbeddings(duplicateIds, userId);
        }
        duplicatesRemoved = duplicateIds.length;

        this.logger.log({
          action: "memory_compression.light_mode.duplicates_removed",
          planId,
          duplicatesRemoved,
        });
      } else {
        this.logger.log({
          action: "memory_compression.light_mode.no_duplicates",
          planId,
        });
      }
    } else if (mode === "full") {
      // Full mode: cluster + merge + archive
      this.logger.log({
        action: "memory_compression.full_mode.start",
        planId,
        embeddingsBefore: beforeCount,
      });

      const clusters = await this.groupSimilarEmbeddings(planId);

      // Process clusters in parallel batches for better performance
      const validClusters = clusters.filter(
        (c) => c.embeddings.length >= MEMORY_COMPRESSION_MIN_CLUSTER_SIZE,
      );

      this.logger.log({
        action: "memory_compression.full_mode.clusters_found",
        planId,
        totalClusters: clusters.length,
        validClusters: validClusters.length,
        totalEmbeddingsInClusters: validClusters.reduce(
          (sum, c) => sum + c.embeddings.length,
          0,
        ),
      });

      // Process clusters in batches to avoid overwhelming the system
      for (
        let i = 0;
        i < validClusters.length;
        i += MEMORY_COMPRESSION_PARALLEL_CLUSTER_BATCH_SIZE
      ) {
        const batch = validClusters.slice(
          i,
          i + MEMORY_COMPRESSION_PARALLEL_CLUSTER_BATCH_SIZE,
        );

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(async (cluster) => {
            try {
              const { summaryEmbedding, originalIds } =
                await this.mergeCluster(cluster);

              if (summaryEmbedding && originalIds.length > 0) {
                if (!dryRun) {
                  await this.archiveEmbeddings(originalIds, userId);
                }
                return {
                  success: true,
                  archived: originalIds.length,
                };
              }
              return { success: false, archived: 0 };
            } catch (error) {
              this.logger.error({
                action: "memory_compression.merge_cluster_failed",
                planId,
                clusterSize: cluster.embeddings.length,
                error: error instanceof Error ? error.message : "Unknown error",
              });
              return { success: false, archived: 0 };
            }
          }),
        );

        // Aggregate results
        for (const result of results) {
          if (result.status === "fulfilled" && result.value.success) {
            embeddingsArchived += result.value.archived;
            clustersMerged++;
          }
        }

        const successfulResults = results.filter(
          (
            r,
          ): r is PromiseFulfilledResult<{
            success: boolean;
            archived: number;
          }> => r.status === "fulfilled" && r.value.success,
        );

        this.logger.log({
          action: "memory_compression.full_mode.batch_processed",
          planId,
          batchIndex:
            Math.floor(i / MEMORY_COMPRESSION_PARALLEL_CLUSTER_BATCH_SIZE) + 1,
          batchSize: batch.length,
          clustersMergedInBatch: successfulResults.length,
          embeddingsArchivedInBatch: successfulResults.reduce(
            (sum, r) => sum + r.value.archived,
            0,
          ),
        });
      }

      this.logger.log({
        action: "memory_compression.full_mode.merging_complete",
        planId,
        totalClustersMerged: clustersMerged,
        totalEmbeddingsArchived: embeddingsArchived,
      });
    }

    // Get final embedding count
    const afterCount = await this.embeddingsRepo.count({
      where: { planId, isDeleted: false },
    });

    const durationMs = Date.now() - startTime;
    const compressionRatio =
      beforeCount > 0 ? (beforeCount - afterCount) / beforeCount : 0;
    const compressionPercentage = (compressionRatio * 100).toFixed(2);
    const reductionCount = beforeCount - afterCount;

    const result: CompressionResult = {
      planId,
      mode,
      beforeCount,
      afterCount,
      compressionRatio,
      duplicatesRemoved: mode === "light" ? duplicatesRemoved : undefined,
      clustersMerged: mode === "full" ? clustersMerged : undefined,
      embeddingsArchived: mode === "full" ? embeddingsArchived : undefined,
      durationMs,
    };

    this.logger.log({
      action: "memory_compression.complete",
      planId,
      mode,
      dryRun,
      embeddingsBefore: beforeCount,
      embeddingsAfter: afterCount,
      embeddingsReduced: reductionCount,
      compressionRatio: compressionRatio.toFixed(4),
      compressionPercentage: `${compressionPercentage}%`,
      duplicatesRemoved: mode === "light" ? duplicatesRemoved : undefined,
      clustersMerged: mode === "full" ? clustersMerged : undefined,
      embeddingsArchived: mode === "full" ? embeddingsArchived : undefined,
      durationMs,
      durationSeconds: (durationMs / 1000).toFixed(2),
    });

    return result;
  }

  /**
   * Find redundant/duplicate embeddings
   * Uses in-memory vector caching for performance
   */
  async findRedundantEmbeddings(planId: string): Promise<string[][]> {
    this.logger.log({
      action: "memory_compression.find_redundant.start",
      planId,
    });

    // Fetch all eligible embeddings with vectors (cached in memory)
    const eligibleEmbeddings = await this.getEligibleEmbeddings(
      planId,
      MEMORY_COMPRESSION_MIN_AGE_DAYS,
    );

    // Cache vectors in memory for fast similarity calculations
    const vectorCache = this.buildVectorCache(eligibleEmbeddings);

    const duplicateGroups: string[][] = [];
    const processed = new Set<string>();

    // Use in-memory similarity calculations instead of DB queries
    for (const cached of vectorCache) {
      if (processed.has(cached.id)) {
        continue;
      }

      // Find similar embeddings using in-memory cosine similarity
      const similar = this.findSimilarInMemory(
        cached,
        vectorCache,
        MEMORY_COMPRESSION_DUPLICATE_THRESHOLD,
      );

      if (similar.length > 0) {
        const group = [cached.id, ...similar.map((s) => s.id)];
        duplicateGroups.push(group);

        // Mark all as processed
        group.forEach((id) => processed.add(id));
      }
    }

    this.logger.log({
      action: "memory_compression.find_redundant.complete",
      planId,
      duplicateGroupsFound: duplicateGroups.length,
      totalDuplicates: duplicateGroups.reduce(
        (sum, group) => sum + group.length - 1,
        0,
      ),
    });

    return duplicateGroups;
  }

  /**
   * Group similar embeddings into clusters
   * Uses in-memory vector caching for performance
   */
  async groupSimilarEmbeddings(planId: string): Promise<EmbeddingCluster[]> {
    this.logger.log({
      action: "memory_compression.group_similar.start",
      planId,
    });

    // Fetch all eligible embeddings with vectors (cached in memory)
    const eligibleEmbeddings = await this.getEligibleEmbeddings(
      planId,
      MEMORY_COMPRESSION_MIN_AGE_DAYS,
    );

    // Cache vectors in memory for fast similarity calculations
    const vectorCache = this.buildVectorCache(eligibleEmbeddings);

    const clusters: EmbeddingCluster[] = [];
    const assigned = new Set<string>();

    // Use in-memory similarity calculations instead of DB queries
    for (const cached of vectorCache) {
      if (assigned.has(cached.id)) {
        continue;
      }

      // Find similar embeddings using in-memory cosine similarity
      const similar = this.findSimilarInMemory(
        cached,
        vectorCache,
        MEMORY_COMPRESSION_SIMILARITY_THRESHOLD,
      );

      // Filter to embeddings that meet similarity threshold and aren't assigned
      const clusterMembers = similar
        .filter((s) => !assigned.has(s.id))
        .slice(0, MEMORY_COMPRESSION_MAX_CLUSTER_SIZE - 1); // -1 because we include the seed embedding

      if (clusterMembers.length >= MEMORY_COMPRESSION_MIN_CLUSTER_SIZE - 1) {
        // Get full embedding objects from cache
        const memberIds = [cached.id, ...clusterMembers.map((m) => m.id)];
        const members = memberIds
          .map((id) => vectorCache.find((v) => v.id === id)?.embedding)
          .filter((e): e is Embedding => e !== undefined);

        if (members.length >= MEMORY_COMPRESSION_MIN_CLUSTER_SIZE) {
          // Calculate average similarity for the cluster
          const avgSimilarity =
            clusterMembers.reduce((sum, m) => sum + m.similarity, 0) /
            clusterMembers.length;

          clusters.push({
            embeddings: members,
            similarity: avgSimilarity,
          });

          // Mark all as assigned
          memberIds.forEach((id) => assigned.add(id));
        }
      }
    }

    this.logger.log({
      action: "memory_compression.group_similar.complete",
      planId,
      clustersFound: clusters.length,
      totalEmbeddingsClustered: clusters.reduce(
        (sum, c) => sum + c.embeddings.length,
        0,
      ),
    });

    return clusters;
  }

  /**
   * Merge a cluster into a single summary embedding
   */
  async mergeCluster(
    cluster: EmbeddingCluster,
  ): Promise<{ summaryEmbedding: Embedding | null; originalIds: string[] }> {
    const originalIds = cluster.embeddings.map((e) => e.id);
    const planId = cluster.embeddings[0]?.planId;

    if (!planId) {
      throw new BadRequestException("Cannot merge cluster: missing planId");
    }

    this.logger.log({
      action: "memory_compression.merge_cluster.start",
      planId,
      clusterSize: cluster.embeddings.length,
    });

    // Combine text contents
    const contents = cluster.embeddings.map((e) => e.content);

    // Generate summary (or use concatenation for small clusters)
    const summaryText =
      cluster.embeddings.length >=
      MEMORY_COMPRESSION_MIN_CLUSTER_SIZE_FOR_SUMMARY
        ? await this.generateClusterSummary(contents)
        : this.concatenateClusterContents(contents);

    // Create summary embedding using EmbeddingsService
    // Note: We use a special refType to mark summary embeddings
    const summaryEmbedding = await this.dataSource.transaction(async (trx) => {
      // Generate embedding for summary text
      const vectors = await this.llmClient.embed([summaryText]);
      if (!vectors?.length || !Array.isArray(vectors[0])) {
        throw new BadRequestException("Failed to generate summary embedding");
      }

      let vector = vectors[0];

      // Normalize if needed (reuse from EmbeddingsService pattern)
      const NORMALIZE_VECTORS = process.env.EMBED_NORMALIZE === "true";
      if (NORMALIZE_VECTORS) {
        vector = this.normalizeVector(vector);
      }

      // Create summary embedding
      const repo = trx.getRepository(Embedding);
      const summary = repo.create({
        planId,
        vector,
        content: summaryText,
        refType: "compression_summary",
        refId: null,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return repo.save(summary);
    });

    this.logger.log({
      action: "memory_compression.merge_cluster.complete",
      planId,
      clusterSize: cluster.embeddings.length,
      summaryId: summaryEmbedding.id,
    });

    return { summaryEmbedding, originalIds };
  }

  /**
   * Archive (soft-delete) embeddings
   */
  async archiveEmbeddings(
    embeddingIds: string[],
    userId?: string,
  ): Promise<void> {
    if (embeddingIds.length === 0) {
      return;
    }

    this.logger.log({
      action: "memory_compression.archive.start",
      embeddingCount: embeddingIds.length,
      userId: userId ?? null,
    });

    await this.dataSource.transaction(async (trx) => {
      const repo = trx.getRepository(Embedding);
      const now = new Date();

      await repo
        .createQueryBuilder()
        .update(Embedding)
        .set({
          isDeleted: true,
          deletedAt: now,
          deletedBy: userId ?? undefined,
        })
        .where("id IN (:...ids)", { ids: embeddingIds })
        .execute();
    });

    this.logger.log({
      action: "memory_compression.archive.complete",
      embeddingCount: embeddingIds.length,
    });
  }

  // ───────────── Helper Methods ─────────────

  /**
   * Find similar embeddings using vector similarity
   */
  async findSimilarEmbeddings(
    embeddingId: string,
    planId: string,
    threshold: number,
  ): Promise<Array<{ id: string; similarity: number }>> {
    const embedding = await this.embeddingsRepo.findOne({
      where: { id: embeddingId, planId, isDeleted: false },
    });

    if (!embedding) {
      return [];
    }

    let vector = embedding.vector;

    // Normalize if needed
    const NORMALIZE_VECTORS = process.env.EMBED_NORMALIZE === "true";
    if (NORMALIZE_VECTORS) {
      vector = this.normalizeVector(vector);
    }

    // Format vector for PostgreSQL
    const queryVectorStr = `[${vector.join(",")}]`;

    // Build similarity query
    // Calculate min age date
    const minAgeDate = new Date();
    minAgeDate.setDate(minAgeDate.getDate() - MEMORY_COMPRESSION_MIN_AGE_DAYS);

    // Add early filtering in DB query for better performance
    const sql = `
      SELECT 
        e.id,
        1 - (e.vector <-> $1::vector) AS similarity
      FROM embeddings e
      WHERE e.plan_id = $2
        AND e.id != $3
        AND e.is_deleted = false
        AND e.created_at < $4
        AND (1 - (e.vector <-> $1::vector)) >= $5
      ORDER BY e.vector <-> $1::vector ASC
      LIMIT 100
    `;

    interface RawResult {
      id: string;
      similarity: string | number;
    }

    const rawResults: RawResult[] = await this.dataSource.query(sql, [
      queryVectorStr,
      planId,
      embeddingId,
      minAgeDate,
      threshold, // Early filtering threshold
    ]);

    return rawResults
      .map((row) => ({
        id: row.id,
        similarity:
          typeof row.similarity === "string"
            ? parseFloat(row.similarity)
            : row.similarity,
      }))
      .filter((r) => r.similarity >= threshold);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Normalize vector to unit length (L2 normalization)
   */
  private normalizeVector(v: number[]): number[] {
    const n = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1;
    return v.map((x) => x / n);
  }

  /**
   * Generate summary text from cluster contents using LLM
   */
  private async generateClusterSummary(contents: string[]): Promise<string> {
    const combinedText = contents.join("\n\n---\n\n");

    const prompt = `You are a memory compression assistant. Summarize the following related pieces of information into a concise, coherent summary that preserves the key information and context. The summary should be clear and useful for future reference.

Content to summarize:
${combinedText}

Provide a concise summary that captures the essential information:`;

    try {
      const result = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 500,
      });

      return result.text.trim();
    } catch (error) {
      this.logger.error({
        action: "memory_compression.generate_summary_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Fallback: use concatenation if LLM fails
      this.logger.warn({
        action: "memory_compression.generate_summary_fallback",
        reason: "LLM call failed, using concatenation",
      });
      return this.concatenateClusterContents(contents);
    }
  }

  /**
   * Get embeddings eligible for compression
   * Excludes:
   * - The most recent N embeddings (configurable)
   * - Embeddings linked to active conversations
   */
  private async getEligibleEmbeddings(
    planId: string,
    minAgeDays: number,
  ): Promise<Embedding[]> {
    const minAgeDate = new Date();
    minAgeDate.setDate(minAgeDate.getDate() - minAgeDays);

    // Get all non-deleted embeddings for the plan, ordered by creation date
    const allEmbeddings = await this.embeddingsRepo.find({
      where: {
        planId,
        isDeleted: false,
      },
      order: {
        createdAt: "DESC", // Most recent first
      },
    });

    // Preserve the most recent N embeddings (configurable)
    const toPreserve = allEmbeddings.slice(0, this.preserveRecentCount);
    const preserveIds = new Set(toPreserve.map((e) => e.id));

    // Get active conversation embedding IDs to exclude
    const activeConversationEmbeddingIds =
      await this.getActiveConversationEmbeddingIds(planId);
    const activeIds = new Set(activeConversationEmbeddingIds);

    // Filter to eligible embeddings (old enough AND not in preserve set AND not in active conversations)
    return allEmbeddings.filter(
      (e) =>
        e.createdAt < minAgeDate &&
        !preserveIds.has(e.id) &&
        !activeIds.has(e.id),
    );
  }

  /**
   * Get embedding IDs linked to active conversations
   * A conversation is considered "active" if it has messages within the configured time window
   */
  private async getActiveConversationEmbeddingIds(
    planId: string,
  ): Promise<string[]> {
    const activeDate = new Date();
    activeDate.setDate(activeDate.getDate() - this.activeConversationDays);

    // Find active conversations (with messages in the last N days) using SQL for efficiency
    const activeConversationsSql = `
      SELECT DISTINCT c.id
      FROM conversations c
      WHERE c.plan_id = $1
        AND c.is_deleted = false
        AND c.last_message_at >= $2
    `;

    interface ConversationRow {
      id: string;
    }

    const activeConversationRows = (await this.dataSource.query(
      activeConversationsSql,
      [planId, activeDate],
    )) as unknown as ConversationRow[];
    const activeConversationIds = activeConversationRows.map((row) => row.id);

    if (activeConversationIds.length === 0) {
      return [];
    }

    // Get all message IDs from active conversations
    const activeMessagesSql = `
      SELECT m.id
      FROM messages m
      INNER JOIN conversations c ON m.conversation_id = c.id
      WHERE c.plan_id = $1
        AND c.is_deleted = false
        AND c.last_message_at >= $2
        AND m.is_deleted = false
    `;

    interface MessageRow {
      id: string;
    }

    const activeMessageRows = (await this.dataSource.query(activeMessagesSql, [
      planId,
      activeDate,
    ])) as unknown as MessageRow[];
    const activeMessageIds = activeMessageRows.map((row) => row.id);

    // Query embeddings linked to active conversations or messages
    // Use a single efficient SQL query
    const sql = `
      SELECT e.id
      FROM embeddings e
      WHERE e.plan_id = $1
        AND e.is_deleted = false
        AND (
          (e.ref_type = 'conversation' AND e.ref_id = ANY($2::uuid[]))
          OR (e.ref_type = 'message' AND e.ref_id = ANY($3::uuid[]))
        )
    `;

    interface EmbeddingRow {
      id: string;
    }

    const results = (await this.dataSource.query(sql, [
      planId,
      activeConversationIds.length > 0 ? activeConversationIds : [null],
      activeMessageIds.length > 0 ? activeMessageIds : [null],
    ])) as unknown as EmbeddingRow[];

    return results.map((row) => row.id);
  }

  /**
   * Build in-memory vector cache for fast similarity calculations
   */
  private buildVectorCache(embeddings: Embedding[]): CachedEmbeddingVector[] {
    const NORMALIZE_VECTORS = process.env.EMBED_NORMALIZE === "true";
    const cache: CachedEmbeddingVector[] = [];

    for (const embedding of embeddings) {
      let vector = embedding.vector;

      // Normalize if needed
      if (NORMALIZE_VECTORS) {
        vector = this.normalizeVector(vector);
      }

      cache.push({
        id: embedding.id,
        vector,
        embedding,
      });
    }

    return cache;
  }

  /**
   * Find similar embeddings in memory using cached vectors
   * Much faster than DB queries
   */
  private findSimilarInMemory(
    source: CachedEmbeddingVector,
    cache: CachedEmbeddingVector[],
    threshold: number,
  ): Array<{ id: string; similarity: number }> {
    const results: Array<{ id: string; similarity: number }> = [];

    for (const candidate of cache) {
      if (candidate.id === source.id) {
        continue; // Skip self
      }

      const similarity = this.calculateCosineSimilarity(
        source.vector,
        candidate.vector,
      );

      if (similarity >= threshold) {
        results.push({ id: candidate.id, similarity });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results;
  }

  /**
   * Concatenate cluster contents as fallback when summary generation fails
   * or for small clusters
   */
  private concatenateClusterContents(contents: string[]): string {
    // Sort by length (longest first) to prioritize more informative content
    const sorted = [...contents].sort((a, b) => b.length - a.length);

    // Join with clear separators
    return sorted.join("\n\n---\n\n");
  }

  /**
   * Get compression diagnostics for a plan
   * Provides insights without performing compression
   */
  async getCompressionDiagnostics(
    planId: string,
    userId?: string,
  ): Promise<CompressionDiagnostics> {
    // Verify plan ownership if userId provided
    if (userId) {
      await this.plansService.verifyOwnership(planId, userId);
    }

    // Get all embeddings
    const allEmbeddings = await this.embeddingsRepo.find({
      where: { planId, isDeleted: false },
      order: { createdAt: "DESC" },
    });

    const totalEmbeddings = allEmbeddings.length;

    // Get eligible embeddings (excluding preserved recent ones)
    const eligibleEmbeddings = await this.getEligibleEmbeddings(
      planId,
      MEMORY_COMPRESSION_MIN_AGE_DAYS,
    );

    const preservedEmbeddings = Math.min(
      totalEmbeddings - eligibleEmbeddings.length,
      this.preserveRecentCount,
    );

    // Find duplicate groups (light mode analysis)
    const duplicateGroups = await this.findRedundantEmbeddings(planId);
    const duplicateCount = duplicateGroups.reduce(
      (sum, group) => sum + (group.length > 1 ? group.length - 1 : 0),
      0,
    );

    // Find potential clusters (full mode analysis)
    const potentialClusters = await this.groupSimilarEmbeddings(planId);
    const clusterableEmbeddings = potentialClusters.reduce(
      (sum, cluster) => sum + cluster.embeddings.length,
      0,
    );

    // Estimate compression ratio
    // Light mode: remove duplicates
    const lightModeReduction = duplicateCount;
    // Full mode: cluster and merge (assume 1 summary per cluster replaces cluster)
    const fullModeReduction = clusterableEmbeddings - potentialClusters.length;
    const estimatedReduction = Math.max(lightModeReduction, fullModeReduction);
    const estimatedCompressionRatio =
      totalEmbeddings > 0 ? estimatedReduction / totalEmbeddings : 0;

    return {
      planId,
      totalEmbeddings,
      eligibleEmbeddings: eligibleEmbeddings.length,
      preservedEmbeddings,
      duplicateGroups: duplicateGroups.length,
      potentialClusters: potentialClusters.length,
      estimatedCompressionRatio,
    };
  }

  /**
   * Get memory statistics for a plan
   * Includes current embedding counts and last compression history
   */
  async getMemoryStats(planId: string, userId?: string): Promise<MemoryStats> {
    // Verify plan ownership if userId provided
    if (userId) {
      await this.plansService.verifyOwnership(planId, userId);
    }

    // Get current embedding counts
    const totalEmbeddings = await this.embeddingsRepo.count({
      where: { planId },
    });

    const activeEmbeddings = await this.embeddingsRepo.count({
      where: { planId, isDeleted: false },
    });

    const archivedEmbeddings = totalEmbeddings - activeEmbeddings;

    // Get last completed compression job
    const lastCompressionJob = await this.jobsRepo.findOne({
      where: {
        planId,
        type: "memory_compression",
        state: JobState.COMPLETED,
      },
      order: {
        finishedAt: "DESC",
      },
    });

    let lastCompression: MemoryStats["lastCompression"] = undefined;

    if (lastCompressionJob?.result) {
      const result = lastCompressionJob.result as unknown as {
        data?: CompressionResult;
      };

      if (result.data) {
        const compressionData = result.data;
        lastCompression = {
          mode: compressionData.mode,
          beforeCount: compressionData.beforeCount,
          afterCount: compressionData.afterCount,
          compressionRatio: compressionData.compressionRatio,
          duplicatesRemoved: compressionData.duplicatesRemoved,
          clustersMerged: compressionData.clustersMerged,
          embeddingsArchived: compressionData.embeddingsArchived,
          durationMs: compressionData.durationMs,
          timestamp:
            lastCompressionJob.finishedAt || lastCompressionJob.createdAt,
        };
      }
    }

    return {
      planId,
      totalEmbeddings,
      archivedEmbeddings,
      activeEmbeddings,
      lastCompression,
    };
  }
}
