import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEmbeddingsGlobalTable1763200000000
  implements MigrationInterface
{
  name = "CreateEmbeddingsGlobalTable1763200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create embeddings_global table for storing crawled Google Maps data
    await queryRunner.query(`
      CREATE TABLE "embeddings_global" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "place_id" character varying(255) NOT NULL,
        "region_id" character varying(100) NOT NULL,
        "place_type" character varying(50) NOT NULL,
        "vector" vector(1536) NOT NULL,
        "content" text NOT NULL,
        "raw_data" jsonb NOT NULL DEFAULT '{}',
        "name" character varying(500) NOT NULL,
        "address" character varying(1000),
        "lat" decimal(10, 7) NOT NULL,
        "lng" decimal(10, 7) NOT NULL,
        "rating" decimal(2, 1),
        "total_ratings" integer DEFAULT 0,
        "price_level" integer,
        "photos" jsonb DEFAULT '[]',
        "types" jsonb DEFAULT '[]',
        "opening_hours" jsonb,
        "website" character varying(1000),
        "phone_number" character varying(50),
        "crawled_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_embeddings_global" PRIMARY KEY ("id")
      )
    `);

    // Unique index on place_id (Google Maps place IDs are globally unique)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_embeddings_global_place_id" 
        ON "embeddings_global" ("place_id")
    `);

    // Index for querying by region and place type
    await queryRunner.query(`
      CREATE INDEX "idx_embeddings_global_region_type" 
        ON "embeddings_global" ("region_id", "place_type")
    `);

    // Index for checking crawl freshness
    await queryRunner.query(`
      CREATE INDEX "idx_embeddings_global_region_crawled" 
        ON "embeddings_global" ("region_id", "crawled_at")
    `);

    // Index for rating-based filtering
    await queryRunner.query(`
      CREATE INDEX "idx_embeddings_global_rating" 
        ON "embeddings_global" ("region_id", "place_type", "rating" DESC NULLS LAST)
    `);

    // HNSW vector index for semantic search
    await queryRunner.query(`
      CREATE INDEX "idx_embeddings_global_vector" 
        ON "embeddings_global" USING hnsw (vector vector_l2_ops)
    `);

    // Add CHECK constraint for place_type
    await queryRunner.query(`
      ALTER TABLE "embeddings_global" 
        ADD CONSTRAINT "embeddings_global_place_type_check" 
        CHECK (place_type IN ('lodging', 'restaurant', 'tourist_attraction', 'cafe', 'bar', 'other'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" DROP CONSTRAINT "embeddings_global_place_type_check"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_embeddings_global_vector"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_embeddings_global_rating"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_embeddings_global_region_crawled"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_embeddings_global_region_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_embeddings_global_place_id"`,
    );
    await queryRunner.query(`DROP TABLE "embeddings_global"`);
  }
}
