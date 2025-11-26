import { MigrationInterface, QueryRunner } from "typeorm";

export class Gen1764143573739 implements MigrationInterface {
  name = "Gen1764143573739";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_regions_coordinates"`);
    await queryRunner.query(`DROP INDEX "public"."idx_regions_crawl_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_embeddings_global_place_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_embeddings_global_region_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_embeddings_global_region_crawled"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_embeddings_global_rating"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_embeddings_global_vector"`,
    );
    await queryRunner.query(
      `ALTER TABLE "regions" DROP CONSTRAINT "regions_crawl_status_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" DROP CONSTRAINT "embeddings_global_place_type_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" ADD CONSTRAINT "UQ_3d38305ef5accbad696add40ce0" UNIQUE ("place_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" DROP COLUMN "vector"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" ADD "vector" vector NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" ALTER COLUMN "total_ratings" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" ALTER COLUMN "photos" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" ALTER COLUMN "types" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_865d78503978021defd618d372" ON "regions" ("center_lat", "center_lng") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e1644d9e10be80e4424ce56bbb" ON "regions" ("crawl_status", "last_crawled_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcde2baf583bfb812d5bc984bb" ON "embeddings_global" ("region_id", "place_type", "rating") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f188d5048bc4528d645a83ad50" ON "embeddings_global" ("region_id", "crawled_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a273d21f0e770c9e7ab4da784" ON "embeddings_global" ("region_id", "place_type") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a273d21f0e770c9e7ab4da784"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f188d5048bc4528d645a83ad50"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bcde2baf583bfb812d5bc984bb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e1644d9e10be80e4424ce56bbb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_865d78503978021defd618d372"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" ALTER COLUMN "types" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" ALTER COLUMN "photos" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" ALTER COLUMN "total_ratings" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" DROP COLUMN "vector"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" ADD "vector" vector(1536) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" DROP CONSTRAINT "UQ_3d38305ef5accbad696add40ce0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings_global" ADD CONSTRAINT "embeddings_global_place_type_check" CHECK (((place_type)::text = ANY ((ARRAY['lodging'::character varying, 'restaurant'::character varying, 'tourist_attraction'::character varying, 'cafe'::character varying, 'bar'::character varying, 'other'::character varying])::text[])))`,
    );
    await queryRunner.query(
      `ALTER TABLE "regions" ADD CONSTRAINT "regions_crawl_status_check" CHECK (((crawl_status)::text = ANY ((ARRAY['pending'::character varying, 'crawling'::character varying, 'completed'::character varying, 'failed'::character varying, 'stale'::character varying])::text[])))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_embeddings_global_vector" ON "embeddings_global" ("vector") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_embeddings_global_rating" ON "embeddings_global" ("region_id", "place_type", "rating") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_embeddings_global_region_crawled" ON "embeddings_global" ("region_id", "crawled_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_embeddings_global_region_type" ON "embeddings_global" ("region_id", "place_type") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_embeddings_global_place_id" ON "embeddings_global" ("place_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_regions_crawl_status" ON "regions" ("last_crawled_at", "crawl_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_regions_coordinates" ON "regions" ("center_lat", "center_lng") `,
    );
  }
}
