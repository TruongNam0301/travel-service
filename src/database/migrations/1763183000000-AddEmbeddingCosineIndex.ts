import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmbeddingCosineIndex1763183000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, ensure the vector column has dimensions (required for HNSW index)
    // The column might have been created without dimensions in a previous migration
    await queryRunner.query(`
      ALTER TABLE embeddings 
      ALTER COLUMN vector TYPE vector(1536)
    `);

    // Drop the old L2 distance index if it exists (we're switching to cosine similarity)
    await queryRunner.query(`
      DROP INDEX IF EXISTS embeddings_vector_idx
    `);

    // HNSW index for cosine similarity search using <-> operator
    // This index optimizes queries using vector_cosine_ops operator class
    // m: number of bi-directional links (default 16)
    // ef_construction: size of candidate list during construction (default 64)
    const m = Number(process.env.VECTOR_HNSW_M ?? 16);
    const efConstruction = Number(
      process.env.VECTOR_HNSW_EF_CONSTRUCTION ?? 64,
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
        ON embeddings USING hnsw (vector vector_cosine_ops)
        WITH (m = ${m}, ef_construction = ${efConstruction})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_embeddings_vector_hnsw"`,
    );
  }
}
