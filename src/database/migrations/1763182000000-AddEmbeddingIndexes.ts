import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmbeddingIndexes1763182000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Unique index per reference (plan-scoped to match service logic)
    // This ensures one embedding per (plan, ref_type, ref_id) combination
    // Only applies to non-null ref_type/ref_id and non-deleted records
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_embeddings_plan_ref
        ON embeddings(plan_id, ref_type, ref_id)
        WHERE ref_type IS NOT NULL 
          AND ref_id IS NOT NULL 
          AND is_deleted = false
    `);

    // Performance index for plan listing queries
    // Optimizes: WHERE plan_id = X AND is_deleted = false ORDER BY updated_at DESC, id DESC
    // Also helps with createdAt sorting due to index ordering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_plan_recent
        ON embeddings(plan_id, is_deleted, updated_at DESC, id DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_embeddings_plan_recent"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."ux_embeddings_plan_ref"`,
    );
  }
}
