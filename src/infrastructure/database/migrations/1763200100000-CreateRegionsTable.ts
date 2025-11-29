import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRegionsTable1763200100000 implements MigrationInterface {
  name = "CreateRegionsTable1763200100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create regions table for tracking crawled regions
    await queryRunner.query(`
      CREATE TABLE "regions" (
        "id" character varying(100) NOT NULL,
        "display_name" character varying(255) NOT NULL,
        "country" character varying(100),
        "center_lat" decimal(10, 7) NOT NULL,
        "center_lng" decimal(10, 7) NOT NULL,
        "radius_km" integer NOT NULL DEFAULT 20,
        "place_count" integer NOT NULL DEFAULT 0,
        "lodging_count" integer NOT NULL DEFAULT 0,
        "restaurant_count" integer NOT NULL DEFAULT 0,
        "attraction_count" integer NOT NULL DEFAULT 0,
        "last_crawled_at" TIMESTAMP WITH TIME ZONE,
        "crawl_status" character varying(20) NOT NULL DEFAULT 'pending',
        "crawl_error" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_regions" PRIMARY KEY ("id")
      )
    `);

    // Index for finding regions by coordinates (useful for nearby region detection)
    await queryRunner.query(`
      CREATE INDEX "idx_regions_coordinates" 
        ON "regions" ("center_lat", "center_lng")
    `);

    // Index for crawl status monitoring
    await queryRunner.query(`
      CREATE INDEX "idx_regions_crawl_status" 
        ON "regions" ("crawl_status", "last_crawled_at")
    `);

    // Add CHECK constraint for crawl_status
    await queryRunner.query(`
      ALTER TABLE "regions" 
        ADD CONSTRAINT "regions_crawl_status_check" 
        CHECK (crawl_status IN ('pending', 'crawling', 'completed', 'failed', 'stale'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "regions" DROP CONSTRAINT "regions_crawl_status_check"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_regions_crawl_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_regions_coordinates"`,
    );
    await queryRunner.query(`DROP TABLE "regions"`);
  }
}
