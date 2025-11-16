import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Embedding } from "../entities/embedding.entity";
import { PlansService } from "./plans.service";
import { PaginatedResponse } from "../common/dto/paginated-response.dto";
import { LLM_CLIENT } from "../common/services/llm/llm.client";
import type { LlmClient } from "../common/services/llm/llm.client";

export interface SearchOpts {
  topK?: number;
  threshold?: number;
  offset?: number;
  refTypes?: string[];
  from?: Date;
  to?: Date;
  includeDeleted?: boolean;
}

export interface SearchResult {
  id: string;
  refType: string;
  refId: string | null;
  content: string;
  createdAt: Date;
  distance: number;
  similarity: number;
}

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  // Prefer from config; default 1536 for text-embedding-3-small
  private readonly EXPECTED_VECTOR_DIMENSION = Number(
    process.env.LLM_EMBED_DIM ?? 1536,
  );
  // Safety cap for embedding text
  private readonly MAX_TEXT_LEN = 200_000;
  // Batch chunk size for embedding API calls
  private readonly EMBED_CHUNK = Number(process.env.EMBED_BATCH_CHUNK ?? 64);
  // Whether to normalize vectors (L2 normalization for cosine similarity)
  private readonly NORMALIZE_VECTORS = process.env.EMBED_NORMALIZE === "true";
  // Vector search mode: "hnsw" uses HNSW index (faster, approximate), "cosine" uses exact calculation
  private readonly VECTOR_SEARCH_MODE =
    (process.env.VECTOR_SEARCH_MODE as "cosine" | "hnsw") ?? "hnsw";

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Embedding)
    private readonly embeddingsRepo: Repository<Embedding>,
    private readonly plansService: PlansService,
    @Inject(LLM_CLIENT)
    private readonly llmClient: LlmClient,
  ) {}

  /** Create or upsert an embedding under a plan */
  async create(
    userId: string,
    planId: string,
    text: string,
    refType?: string,
    refId?: string,
  ): Promise<Embedding> {
    await this.plansService.verifyOwnership(planId, userId);

    // 2) Normalize text
    const materialized = this.normalize(text);
    if (!materialized) {
      throw new BadRequestException(
        "Text cannot be empty. Please provide valid text content to create an embedding.",
      );
    }

    this.logger.log({
      action: "embeddings.create.request",
      userId,
      planId,
      refType: refType ?? null,
      refId: refId ?? null,
      textLen: materialized.length,
    });

    // 3) Call embed
    const vectors = await this.llmClient.embed([materialized]);
    if (!vectors?.length || !Array.isArray(vectors[0])) {
      throw new BadRequestException(
        "Failed to generate embedding: LLM service returned invalid response",
      );
    }
    let vector = vectors[0];

    // 4) Optional dimension check
    if (
      this.EXPECTED_VECTOR_DIMENSION &&
      vector.length !== this.EXPECTED_VECTOR_DIMENSION
    ) {
      // prefer warning to hard failure if you may swap models
      this.logger.warn({
        action: "embeddings.dimension_mismatch",
        expected: this.EXPECTED_VECTOR_DIMENSION,
        got: vector.length,
        planId,
        userId,
      });
      // Note: We log but don't throw to allow model flexibility
      // If strict dimension checking is needed, uncomment:
      // throw new BadRequestException(
      //   `Vector dimension mismatch: expected ${this.EXPECTED_VECTOR_DIMENSION}, got ${vector.length}. This may indicate a model configuration issue.`,
      // );
    }

    // 5) Normalize vector for accurate cosine similarity (if enabled)
    if (this.NORMALIZE_VECTORS) {
      vector = this.normalizeVector(vector);
    }

    // 6) Upsert by ref (refType+refId), else insert new
    const now = new Date();
    let saved: Embedding;

    if (refType && refId) {
      saved = await this.dataSource.transaction(async (trx) => {
        const repo = trx.getRepository(Embedding);
        // Upsert: find by planId + refType + refId to ensure plan-scoped uniqueness
        const existing = await repo.findOne({
          where: { planId, refType, refId, isDeleted: false },
        });
        if (existing) {
          existing.vector = vector; // store as number[] with pgvector
          existing.content = materialized; // keep latest source text
          existing.updatedAt = now;
          return repo.save(existing);
        }
        const created = repo.create({
          planId,
          vector, // ← number[], not string
          content: materialized,
          refType,
          refId,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        });
        return repo.save(created);
      });
    } else {
      const created = this.embeddingsRepo.create({
        planId,
        vector, // ← number[], not string
        content: materialized,
        refType: refType ?? "manual",
        refId: refId ?? null,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      });
      saved = await this.embeddingsRepo.save(created);
    }

    this.logger.log({
      action: "embeddings.create.ok",
      id: saved.id,
      planId,
      dim: vector.length,
    });

    return saved;
  }

  /** Create or upsert multiple embeddings in a batch (best-effort, transactional per-batch) */
  async createBatch(
    userId: string,
    planId: string,
    items: Array<{ text: string; refType?: string; refId?: string }>,
  ): Promise<Embedding[]> {
    if (!items?.length) {
      throw new BadRequestException(
        "Items array cannot be empty. Please provide at least one item to create embeddings.",
      );
    }

    // 1) Ownership (throws 404 if not owner)
    await this.plansService.verifyOwnership(planId, userId);

    // 2) Normalize + filter empties
    const normalized = items.map((it, idx) => ({
      idx,
      refType: it.refType ?? "manual",
      refId: it.refId ?? null,
      text: this.normalize(it.text),
    }));

    const valid = normalized.filter((i) => i.text.length > 0);
    if (!valid.length) {
      throw new BadRequestException(
        "All texts are empty after normalization. Please provide valid text content.",
      );
    }

    this.logger.log({
      action: "embeddings.createBatch.request",
      userId,
      planId,
      totalItems: items.length,
      validItems: valid.length,
    });

    // 3) De-dup identical texts to save cost
    const uniqueTextToIndexes = new Map<string, number[]>();
    valid.forEach((v, i) => {
      const arr = uniqueTextToIndexes.get(v.text) ?? [];
      arr.push(i);
      uniqueTextToIndexes.set(v.text, arr);
    });

    const uniqueTexts = Array.from(uniqueTextToIndexes.keys());

    // 4) Embed in chunks
    const vectorsByUniqueIndex: number[][] = [];

    for (let start = 0; start < uniqueTexts.length; start += this.EMBED_CHUNK) {
      const chunk = uniqueTexts.slice(start, start + this.EMBED_CHUNK);

      this.logger.debug({
        action: "embeddings.createBatch.chunk.request",
        size: chunk.length,
        start,
      });

      const chunkVectors = await this.llmClient.embed(chunk);

      if (!chunkVectors?.length || chunkVectors.length !== chunk.length) {
        throw new BadRequestException(
          `Failed to generate embeddings for chunk at ${start}: expected ${chunk.length}, got ${chunkVectors?.length ?? 0}`,
        );
      }

      // Optional dimension check + optional L2 normalization
      const processed: number[][] = chunkVectors.map((vec, j) => {
        if (!Array.isArray(vec)) {
          throw new BadRequestException(
            `Invalid vector (chunk offset ${start + j})`,
          );
        }

        if (
          this.EXPECTED_VECTOR_DIMENSION &&
          vec.length !== this.EXPECTED_VECTOR_DIMENSION
        ) {
          this.logger.warn({
            action: "embeddings.dimension_mismatch",
            expected: this.EXPECTED_VECTOR_DIMENSION,
            got: vec.length,
            offset: start + j,
          });
        }

        return this.NORMALIZE_VECTORS ? this.normalizeVector(vec) : vec;
      });

      vectorsByUniqueIndex.push(...processed);

      this.logger.debug({
        action: "embeddings.createBatch.chunk.ok",
        size: chunk.length,
        start,
        dim: processed[0]?.length,
      });
    }

    // 5) Expand vectors back to the valid-item order
    const vectorByValidIndex: number[][] = [];
    for (let i = 0; i < valid.length; i++) {
      vectorByValidIndex.push([] as number[]); // Initialize with empty arrays
    }
    uniqueTexts.forEach((t, uniqueIdx) => {
      const vec = vectorsByUniqueIndex[uniqueIdx];
      (uniqueTextToIndexes.get(t) ?? []).forEach((validIdx) => {
        vectorByValidIndex[validIdx] = vec;
      });
    });

    // 6) Persist (single transaction). Upsert by (planId, refType, refId) when ref provided
    const now = new Date();
    const saved: Embedding[] = [];

    await this.dataSource.transaction(async (trx) => {
      const repo = trx.getRepository(Embedding);

      for (let i = 0; i < valid.length; i++) {
        const v = valid[i];
        const vector = vectorByValidIndex[i];
        const refType = v.refType;
        const refId = v.refId;

        // If ref present, try upsert
        if (refType && refId) {
          const existing = await repo.findOne({
            where: { planId, refType, refId, isDeleted: false },
          });

          // Optional: skip update if nothing changed (saves write IO)
          if (
            existing &&
            existing.content === v.text &&
            this.arraysEqual(existing.vector, vector)
          ) {
            saved.push(existing);
            continue;
          }

          if (existing) {
            existing.vector = vector;
            existing.content = v.text;
            existing.updatedAt = now;
            saved.push(await repo.save(existing));
          } else {
            const created = repo.create({
              planId,
              vector,
              content: v.text,
              refType,
              refId,
              isDeleted: false,
              createdAt: now,
              updatedAt: now,
            });
            saved.push(await repo.save(created));
          }
        } else {
          // Insert fresh row for manual items (no ref)
          const created = repo.create({
            planId,
            vector,
            content: v.text,
            refType: "manual",
            refId: null,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
          });
          saved.push(await repo.save(created));
        }
      }
    });

    this.logger.log({
      action: "embeddings.createBatch.ok",
      planId,
      count: saved.length,
      uniqueTexts: uniqueTexts.length,
      dim: saved[0]?.vector?.length,
    });

    return saved;
  }

  async findById(
    embeddingId: string,
    userId: string,
    includeVector: boolean = false,
  ): Promise<Embedding> {
    this.logger.log({
      action: "embeddings.findById.request",
      embeddingId,
      userId,
      includeVector,
    });

    const qb = this.embeddingsRepo
      .createQueryBuilder("e")
      .where("e.id = :id", { id: embeddingId });

    // Conditionally select vector field
    if (!includeVector) {
      qb.select([
        "e.id",
        "e.planId",
        "e.refType",
        "e.refId",
        "e.content",
        "e.isDeleted",
        "e.deletedAt",
        "e.deletedBy",
        "e.createdAt",
        "e.updatedAt",
      ]);
    }

    const row = await qb.getOne();
    if (!row) {
      throw new NotFoundException(
        `Embedding with id '${embeddingId}' not found`,
      );
    }
    if (row.isDeleted) {
      throw new NotFoundException(
        `Embedding with id '${embeddingId}' has been deleted`,
      );
    }

    await this.plansService.verifyOwnership(row.planId, userId);

    this.logger.log({
      action: "embeddings.findById.ok",
      embeddingId,
      planId: row.planId,
      refType: row.refType,
    });

    return row;
  }

  async findByPlan(
    planId: string,
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      refType?: string;
      refTypes?: string[];
      from?: Date;
      to?: Date;
      sortBy?: "createdAt" | "updatedAt" | "id";
      sortOrder?: "ASC" | "DESC";
      includeDeleted?: boolean;
      includeVector?: boolean;
    },
  ): Promise<PaginatedResponse<Embedding>> {
    await this.plansService.verifyOwnership(planId, userId);

    const page = Math.max(1, Number(options?.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(options?.limit ?? 10)));
    const offset = (page - 1) * limit;
    const refType = options?.refType;
    const refTypes = options?.refTypes;
    const from = options?.from;
    const to = options?.to;
    const sortBy: "createdAt" | "updatedAt" | "id" =
      options?.sortBy ?? "createdAt";
    const sortOrder = options?.sortOrder === "ASC" ? "ASC" : "DESC";
    const includeDeleted = !!options?.includeDeleted;
    const includeVector = !!options?.includeVector;

    this.logger.log({
      action: "embeddings.findByPlan.request",
      planId,
      userId,
      page,
      limit,
      refType,
      refTypes: refTypes?.length ?? null,
      hasDateRange: !!(from || to),
      includeDeleted,
      includeVector,
      sortBy,
      sortOrder,
    });

    const qb = this.embeddingsRepo
      .createQueryBuilder("e")
      .where("e.plan_id = :planId", { planId })
      .orderBy(`e.${sortBy}`, sortOrder)
      .addOrderBy("e.id", "ASC") // stable
      .offset(offset)
      .limit(limit);

    if (!includeDeleted) qb.andWhere("e.is_deleted = false");
    if (refType) qb.andWhere("e.ref_type = :refType", { refType });
    if (refTypes && refTypes.length > 0) {
      qb.andWhere("e.ref_type IN (:...refTypes)", { refTypes });
    }
    if (from) {
      qb.andWhere("e.created_at >= :from", { from });
    }
    if (to) {
      qb.andWhere("e.created_at <= :to", { to });
    }

    // Conditionally select vector field
    if (!includeVector) {
      qb.select([
        "e.id",
        "e.planId",
        "e.refType",
        "e.refId",
        "e.content",
        "e.isDeleted",
        "e.deletedAt",
        "e.deletedBy",
        "e.createdAt",
        "e.updatedAt",
      ]);
    }

    const [data, total] = await qb.getManyAndCount();

    this.logger.log({
      action: "embeddings.findByPlan.ok",
      planId,
      userId,
      resultCount: data.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Soft delete */
  async delete(embeddingId: string, userId: string): Promise<void> {
    const row = await this.findById(embeddingId, userId);

    row.isDeleted = true;
    row.deletedAt = new Date();
    row.deletedBy = userId;
    await this.embeddingsRepo.save(row);

    this.logger.log({
      action: "embeddings.delete.ok",
      id: embeddingId,
      planId: row.planId,
    });
  }

  /**
   * Semantic search for similar embeddings using cosine similarity
   */
  async searchSimilar(
    userId: string,
    planId: string,
    query: string,
    opts?: SearchOpts,
  ): Promise<SearchResult[]> {
    const startTime = Date.now();

    // 1) Validate query
    const normalizedQuery = this.normalize(query);
    if (!normalizedQuery || normalizedQuery.length < 1) {
      throw new BadRequestException(
        "Search query cannot be empty. Please provide a valid search query.",
      );
    }

    // 2) Verify ownership (throws 404 if not owner)
    await this.plansService.verifyOwnership(planId, userId);

    // 3) Parse options with defaults
    const topK = Math.min(100, Math.max(1, opts?.topK ?? 10));
    const threshold = opts?.threshold ?? 0;
    const offset = Math.max(0, opts?.offset ?? 0);
    const refTypes = opts?.refTypes;
    const from = opts?.from;
    const to = opts?.to;
    const includeDeleted = opts?.includeDeleted ?? false;

    // 4) Log search request
    this.logger.log({
      action: "embeddings.search.request",
      userId,
      planId,
      queryLen: normalizedQuery.length,
      topK,
      threshold,
      offset,
      refTypes: refTypes?.length ?? null,
      hasDateRange: !!(from || to),
      includeDeleted,
      searchMode: this.VECTOR_SEARCH_MODE,
    });

    // 5) Generate query embedding
    const queryVectors = await this.llmClient.embed([normalizedQuery]);
    if (!queryVectors?.length || !Array.isArray(queryVectors[0])) {
      throw new BadRequestException(
        "Failed to generate query embedding: LLM service returned invalid response",
      );
    }
    let queryVector = queryVectors[0];

    // 6) Normalize query vector if enabled
    if (this.NORMALIZE_VECTORS) {
      queryVector = this.normalizeVector(queryVector);
    }

    // 7) Format query vector as PostgreSQL array literal
    // Note: Vector is generated by our LLM client (number array), so safe to format
    const queryVectorStr = `[${queryVector.join(",")}]`;

    // 8) Build SQL query with pgvector cosine distance
    // Using raw SQL for pgvector operations as TypeORM doesn't have native support
    // The <-> operator uses HNSW index if available (when VECTOR_SEARCH_MODE=hnsw)
    // For exact cosine calculation, we can disable index usage, but the operator remains the same
    const queryParts: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Note: The <-> operator automatically uses HNSW index when available
    // VECTOR_SEARCH_MODE is logged for monitoring but doesn't change the query

    queryParts.push(`
      SELECT 
        e.id,
        e.ref_type AS "refType",
        e.ref_id AS "refId",
        e.content,
        e.created_at AS "createdAt",
        e.vector <-> $${paramIndex}::vector AS distance
      FROM embeddings e
      WHERE e.plan_id = $${++paramIndex}
    `);
    queryParams.push(queryVectorStr, planId);

    // Apply filters
    if (!includeDeleted) {
      queryParts.push(` AND e.is_deleted = false`);
    }

    if (refTypes && refTypes.length > 0) {
      queryParts.push(` AND e.ref_type = ANY($${++paramIndex})`);
      queryParams.push(refTypes);
    }

    if (from || to) {
      if (from && to) {
        queryParts.push(
          ` AND e.created_at BETWEEN $${++paramIndex} AND $${++paramIndex}`,
        );
        queryParams.push(from, to);
      } else if (from) {
        queryParts.push(` AND e.created_at >= $${++paramIndex}`);
        queryParams.push(from);
      } else if (to) {
        queryParts.push(` AND e.created_at <= $${++paramIndex}`);
        queryParams.push(to);
      }
    }

    // Order by distance (closest first), then id (stable sort)
    queryParts.push(` ORDER BY distance ASC, e.id ASC`);

    // Apply pagination
    queryParts.push(` LIMIT $${++paramIndex} OFFSET $${++paramIndex}`);
    queryParams.push(topK, offset);

    // 9) Execute query
    const sql = queryParts.join("");
    interface RawSearchResult {
      id: string;
      refType: string;
      refId: string | null;
      content: string;
      createdAt: Date | string;
      distance: string | number;
    }
    const rawResults: RawSearchResult[] = await this.dataSource.query(
      sql,
      queryParams,
    );

    // 10) Map results and compute similarity
    const results: SearchResult[] = rawResults
      .map((row) => {
        const distance =
          typeof row.distance === "string"
            ? parseFloat(row.distance)
            : row.distance;
        const similarity = Math.max(0, Math.min(1, 1 - distance));
        return {
          id: row.id,
          refType: row.refType,
          refId: row.refId,
          content: row.content,
          createdAt: new Date(row.createdAt),
          distance,
          similarity,
        };
      })
      .filter((result) => result.similarity >= threshold);

    // 11) Calculate metrics
    const latencyMs = Date.now() - startTime;
    const avgDistance =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.distance, 0) / results.length
        : 0;

    // 12) Log search completion
    this.logger.log({
      action: "embeddings.search.ok",
      userId,
      planId,
      resultCount: results.length,
      topK,
      threshold,
      latencyMs,
      avgDistance: avgDistance.toFixed(6),
      searchMode: this.VECTOR_SEARCH_MODE,
    });

    return results;
  }

  /**
   * Search similar embeddings (internal use, no ownership check)
   * Used by context builders
   */
  async searchSimilarInternal(
    planId: string,
    query: string,
    opts?: SearchOpts,
  ): Promise<SearchResult[]> {
    // Use a dummy userId for internal calls - we'll bypass ownership check
    // by using a special internal flag or by modifying the service
    // For now, we'll need to get userId from plan
    const plan = await this.plansService.findOneById(planId);
    if (!plan) {
      return [];
    }

    // Use the regular search method with plan owner's userId
    return await this.searchSimilar(plan.userId, planId, query, opts);
  }

  // ───────────── helpers ─────────────
  private normalize(s: string): string {
    return (s ?? "").replace(/\s+/g, " ").trim().slice(0, this.MAX_TEXT_LEN);
  }

  /**
   * Normalize vector to unit length (L2 normalization) for accurate cosine similarity.
   * Returns a new normalized vector array.
   */
  private normalizeVector(v: number[]): number[] {
    const n = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1;
    return v.map((x) => x / n);
  }

  /**
   * Compare two number arrays for equality (used to skip unnecessary updates).
   */
  private arraysEqual(a?: number[], b?: number[]): boolean {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
}
