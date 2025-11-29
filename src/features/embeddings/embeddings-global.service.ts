import { Injectable, Logger, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  EmbeddingGlobal,
  GlobalPlaceType,
  RawPlaceData,
} from "./entities/embedding-global.entity";
import * as llmClient_1 from "../../infrastructure/llm/llm.client";
import {
  PlaceDetailsResult,
  PlacePhoto,
} from "../../infrastructure/google-maps";

export interface PlaceFilter {
  minRating?: number;
  maxPriceLevel?: number;
  types?: string[];
  openNow?: boolean;
}

export interface StorePlaceInput {
  placeId: string;
  regionId: string;
  placeType: GlobalPlaceType;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  rating?: number;
  totalRatings?: number;
  priceLevel?: number;
  photos?: PlacePhoto[];
  types?: string[];
  openingHours?: Record<string, unknown>;
  website?: string;
  phoneNumber?: string;
  rawData: RawPlaceData;
}

export interface GlobalSearchResult {
  id: string;
  placeId: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  rating?: number;
  totalRatings: number;
  priceLevel?: number;
  types: string[];
  distance?: number;
  similarity?: number;
}

@Injectable()
export class EmbeddingsGlobalService {
  private readonly logger = new Logger(EmbeddingsGlobalService.name);
  private readonly EMBED_BATCH_SIZE = 50;
  private readonly MAX_TEXT_LEN = 50000;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(EmbeddingGlobal)
    private readonly embeddingGlobalRepo: Repository<EmbeddingGlobal>,
    @Inject(llmClient_1.LLM_CLIENT)
    private readonly llmClient: llmClient_1.LlmClient,
  ) {}

  /**
   * Store a single place with its embedding
   */
  async storePlace(input: StorePlaceInput): Promise<EmbeddingGlobal> {
    // Check if place already exists
    const existing = await this.embeddingGlobalRepo.findOne({
      where: { placeId: input.placeId },
    });

    // Generate embedding content
    const content = this.generateEmbeddingContent(input);

    // Generate embedding vector
    const vectors = await this.llmClient.embed([content]);
    if (!vectors?.length || !Array.isArray(vectors[0])) {
      throw new Error("Failed to generate embedding vector");
    }
    const vector = vectors[0];

    if (existing) {
      // Update existing place
      existing.vector = vector;
      existing.content = content;
      existing.rawData = input.rawData;
      existing.name = input.name;
      existing.address = input.address;
      existing.rating = input.rating;
      existing.totalRatings = input.totalRatings || 0;
      existing.priceLevel = input.priceLevel;
      existing.photos = input.photos || [];
      existing.types = input.types || [];
      existing.openingHours =
        input.openingHours as EmbeddingGlobal["openingHours"];
      existing.website = input.website;
      existing.phoneNumber = input.phoneNumber;
      existing.crawledAt = new Date();

      return await this.embeddingGlobalRepo.save(existing);
    }

    // Create new place
    const embedding = this.embeddingGlobalRepo.create({
      placeId: input.placeId,
      regionId: input.regionId,
      placeType: input.placeType,
      vector,
      content,
      rawData: input.rawData,
      name: input.name,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      rating: input.rating,
      totalRatings: input.totalRatings || 0,
      priceLevel: input.priceLevel,
      photos: input.photos || [],
      types: input.types || [],
      openingHours: input.openingHours as EmbeddingGlobal["openingHours"],
      website: input.website,
      phoneNumber: input.phoneNumber,
      crawledAt: new Date(),
    });

    return await this.embeddingGlobalRepo.save(embedding);
  }

  /**
   * Store multiple places in batch (efficient for crawling)
   */
  async storePlacesBatch(
    places: StorePlaceInput[],
    regionId: string,
  ): Promise<{ stored: number; errors: number }> {
    if (!places.length) {
      return { stored: 0, errors: 0 };
    }

    let stored = 0;
    let errors = 0;

    // Process in batches for embedding generation
    for (let i = 0; i < places.length; i += this.EMBED_BATCH_SIZE) {
      const batch = places.slice(i, i + this.EMBED_BATCH_SIZE);

      try {
        // Generate content for all places in batch
        const contents = batch.map((p) => this.generateEmbeddingContent(p));

        // Generate embeddings in batch
        const vectors = await this.llmClient.embed(contents);

        if (!vectors?.length || vectors.length !== batch.length) {
          this.logger.error({
            action: "embeddings_global.batch_embed_failed",
            expected: batch.length,
            received: vectors?.length || 0,
          });
          errors += batch.length;
          continue;
        }

        // Upsert each place
        await this.dataSource.transaction(async (trx) => {
          const repo = trx.getRepository(EmbeddingGlobal);

          for (let j = 0; j < batch.length; j++) {
            const place = batch[j];
            const vector = vectors[j];
            const content = contents[j];

            try {
              // Check if exists
              const existing = await repo.findOne({
                where: { placeId: place.placeId },
              });

              if (existing) {
                // Update
                existing.vector = vector;
                existing.content = content;
                existing.rawData = place.rawData;
                existing.name = place.name;
                existing.address = place.address;
                existing.rating = place.rating;
                existing.totalRatings = place.totalRatings || 0;
                existing.priceLevel = place.priceLevel;
                existing.photos = place.photos || [];
                existing.types = place.types || [];
                existing.openingHours =
                  place.openingHours as EmbeddingGlobal["openingHours"];
                existing.website = place.website;
                existing.phoneNumber = place.phoneNumber;
                existing.crawledAt = new Date();
                await repo.save(existing);
              } else {
                // Create
                const embedding = repo.create({
                  placeId: place.placeId,
                  regionId,
                  placeType: place.placeType,
                  vector,
                  content,
                  rawData: place.rawData,
                  name: place.name,
                  address: place.address,
                  lat: place.lat,
                  lng: place.lng,
                  rating: place.rating,
                  totalRatings: place.totalRatings || 0,
                  priceLevel: place.priceLevel,
                  photos: place.photos || [],
                  types: place.types || [],
                  openingHours:
                    place.openingHours as EmbeddingGlobal["openingHours"],
                  website: place.website,
                  phoneNumber: place.phoneNumber,
                  crawledAt: new Date(),
                });
                await repo.save(embedding);
              }
              stored++;
            } catch (err) {
              this.logger.error({
                action: "embeddings_global.store_place_failed",
                placeId: place.placeId,
                error: err instanceof Error ? err.message : "Unknown error",
              });
              errors++;
            }
          }
        });

        this.logger.log({
          action: "embeddings_global.batch_stored",
          batchIndex: i / this.EMBED_BATCH_SIZE,
          batchSize: batch.length,
          stored,
        });
      } catch (err) {
        this.logger.error({
          action: "embeddings_global.batch_failed",
          batchIndex: i / this.EMBED_BATCH_SIZE,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        errors += batch.length;
      }
    }

    this.logger.log({
      action: "embeddings_global.batch_complete",
      regionId,
      totalPlaces: places.length,
      stored,
      errors,
    });

    return { stored, errors };
  }

  /**
   * Search places by region with filters
   */
  async searchByRegion(
    regionId: string,
    placeType: GlobalPlaceType,
    filters?: PlaceFilter,
    limit: number = 20,
    offset: number = 0,
  ): Promise<EmbeddingGlobal[]> {
    const qb = this.embeddingGlobalRepo
      .createQueryBuilder("e")
      .where("e.region_id = :regionId", { regionId })
      .andWhere("e.place_type = :placeType", { placeType });

    // Apply filters
    if (filters?.minRating) {
      qb.andWhere("e.rating >= :minRating", { minRating: filters.minRating });
    }
    if (filters?.maxPriceLevel !== undefined) {
      qb.andWhere("e.price_level <= :maxPriceLevel", {
        maxPriceLevel: filters.maxPriceLevel,
      });
    }
    if (filters?.types?.length) {
      // Check if any of the place's types match the filter
      qb.andWhere("e.types && :types::jsonb", {
        types: JSON.stringify(filters.types),
      });
    }

    // Order by rating descending
    qb.orderBy("e.rating", "DESC", "NULLS LAST")
      .addOrderBy("e.total_ratings", "DESC")
      .offset(offset)
      .limit(limit);

    return await qb.getMany();
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(
    regionId: string,
    query: string,
    placeType?: GlobalPlaceType,
    topK: number = 10,
    threshold: number = 0,
  ): Promise<GlobalSearchResult[]> {
    // Generate query embedding
    const vectors = await this.llmClient.embed([query]);
    if (!vectors?.length || !Array.isArray(vectors[0])) {
      throw new Error("Failed to generate query embedding");
    }
    const queryVector = vectors[0];
    const queryVectorStr = `[${queryVector.join(",")}]`;

    // Build query
    let sql = `
      SELECT 
        e.id,
        e.place_id AS "placeId",
        e.name,
        e.address,
        e.lat,
        e.lng,
        e.rating,
        e.total_ratings AS "totalRatings",
        e.price_level AS "priceLevel",
        e.types,
        e.vector <-> $1::vector AS distance
      FROM embeddings_global e
      WHERE e.region_id = $2
    `;

    const params: (string | number)[] = [queryVectorStr, regionId];
    let paramIndex = 3;

    if (placeType) {
      sql += ` AND e.place_type = $${paramIndex}`;
      params.push(placeType);
      paramIndex++;
    }

    sql += ` ORDER BY distance ASC LIMIT $${paramIndex}`;
    params.push(topK);

    interface RawResult {
      id: string;
      placeId: string;
      name: string;
      address?: string;
      lat: string;
      lng: string;
      rating?: string;
      totalRatings: number;
      priceLevel?: number;
      types: string[];
      distance: string;
    }

    const rawResults: RawResult[] = await this.dataSource.query(sql, params);

    return rawResults
      .map((r) => {
        const distance = parseFloat(r.distance);
        const similarity = Math.max(0, Math.min(1, 1 - distance));
        return {
          id: r.id,
          placeId: r.placeId,
          name: r.name,
          address: r.address,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lng),
          rating: r.rating ? parseFloat(r.rating) : undefined,
          totalRatings: r.totalRatings,
          priceLevel: r.priceLevel,
          types: r.types,
          distance,
          similarity,
        };
      })
      .filter((r) => r.similarity >= threshold);
  }

  /**
   * Get count of places by region and type
   */
  async getRegionStats(regionId: string): Promise<{
    total: number;
    lodging: number;
    restaurant: number;
    attraction: number;
  }> {
    const stats = await this.embeddingGlobalRepo
      .createQueryBuilder("e")
      .select("e.place_type", "placeType")
      .addSelect("COUNT(*)", "count")
      .where("e.region_id = :regionId", { regionId })
      .groupBy("e.place_type")
      .getRawMany<{ placeType: GlobalPlaceType; count: string }>();

    const result = {
      total: 0,
      lodging: 0,
      restaurant: 0,
      attraction: 0,
    };

    for (const stat of stats) {
      const count = parseInt(stat.count, 10);
      result.total += count;

      switch (stat.placeType) {
        case "lodging":
          result.lodging = count;
          break;
        case "restaurant":
        case "cafe":
        case "bar":
          result.restaurant += count;
          break;
        case "tourist_attraction":
          result.attraction = count;
          break;
      }
    }

    return result;
  }

  /**
   * Convert PlaceDetailsResult to StorePlaceInput
   */
  placeDetailsToInput(
    place: PlaceDetailsResult,
    regionId: string,
    placeType: GlobalPlaceType,
  ): StorePlaceInput {
    return {
      placeId: place.placeId,
      regionId,
      placeType,
      name: place.name,
      address: place.address,
      lat: place.location.lat,
      lng: place.location.lng,
      rating: place.rating,
      totalRatings: place.totalRatings,
      priceLevel: place.priceLevel,
      photos: place.photos,
      types: place.types,
      openingHours: place.openingHours as Record<string, unknown>,
      website: place.website,
      phoneNumber: place.phoneNumber,
      rawData: {
        placeId: place.placeId,
        name: place.name,
        formattedAddress: place.address,
        geometry: {
          location: place.location,
        },
        rating: place.rating,
        userRatingsTotal: place.totalRatings,
        priceLevel: place.priceLevel,
        types: place.types,
        photos: place.photos,
        openingHours: place.openingHours,
        website: place.website,
        formattedPhoneNumber: place.phoneNumber,
        reviews: place.reviews?.map((r) => ({
          authorName: r.authorName,
          rating: r.rating,
          text: r.text,
          time: r.time,
        })),
        editorialSummary: place.editorialSummary
          ? { overview: place.editorialSummary }
          : undefined,
        url: place.googleMapsUrl,
      },
    };
  }

  /**
   * Generate embedding content for a place
   */
  private generateEmbeddingContent(place: StorePlaceInput): string {
    const parts: string[] = [
      place.name,
      place.address || "",
      `Rating: ${place.rating ?? "N/A"}`,
      `Reviews: ${place.totalRatings ?? 0}`,
    ];

    if (place.priceLevel !== undefined) {
      parts.push(`Price Level: ${"$".repeat(place.priceLevel + 1)}`);
    }

    if (place.types?.length) {
      parts.push(`Types: ${place.types.join(", ")}`);
    }

    // Include editorial summary or reviews if available
    if (place.rawData.editorialSummary?.overview) {
      parts.push(`Description: ${place.rawData.editorialSummary.overview}`);
    }

    if (place.rawData.reviews?.length) {
      const topReviews = place.rawData.reviews
        .slice(0, 3)
        .map((r) => r.text)
        .join(" | ");
      parts.push(`Reviews: ${topReviews}`);
    }

    const content = parts.join(". ");
    return content.slice(0, this.MAX_TEXT_LEN);
  }
}
