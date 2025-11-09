import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1762687705349 implements MigrationInterface {
  name = "InitialSchema1762687705349";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(
      `CREATE TABLE "jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plan_id" uuid NOT NULL, "type" character varying(100) NOT NULL, "params" jsonb DEFAULT '{}', "result" jsonb, "state" character varying(50) NOT NULL, "error" text, "retries" integer NOT NULL DEFAULT '0', "priority" integer NOT NULL DEFAULT '0', "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, "duration_ms" integer, "worker_id" character varying(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0ed03016155c25246d094d1898" ON "jobs" ("plan_id", "state") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_11e79fa7801c3e7ffa3edbeca4" ON "jobs" ("plan_id", "created_at") `,
    );

    // Add CHECK constraint for job states (flexible, not enum)
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "jobs_state_check" CHECK (state IN ('queued', 'pending', 'processing', 'retrying', 'completed', 'failed', 'cancelled'))`,
    );

    // Add partial index for open/active jobs (high-performance filtering)
    await queryRunner.query(
      `CREATE INDEX "jobs_open_idx" ON "jobs"("plan_id", "state") WHERE state IN ('queued', 'pending', 'processing', 'retrying')`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "role" character varying(20) NOT NULL, "content" text NOT NULL, "is_deleted" boolean NOT NULL DEFAULT false, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8584a1974e1ca95f4861d975ff" ON "messages" ("conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plan_id" uuid NOT NULL, "title" character varying(500) NOT NULL, "is_deleted" boolean NOT NULL DEFAULT false, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "embeddings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plan_id" uuid NOT NULL, "vector" vector(1536) NOT NULL, "ref_type" character varying(50) NOT NULL, "ref_id" uuid NOT NULL, "content" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_19b6b451e1ef345884caca1f544" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6c70ccc40fb83cb822fa87c15e" ON "embeddings" ("plan_id", "ref_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dadabd28e625b8b7e1c6258f08" ON "embeddings" ("plan_id", "created_at") `,
    );

    // Add HNSW vector index for semantic search
    await queryRunner.query(
      `CREATE INDEX "embeddings_vector_idx" ON "embeddings" USING hnsw (vector vector_l2_ops)`,
    );
    await queryRunner.query(
      `CREATE TABLE "plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "title" character varying(500) NOT NULL, "metadata" jsonb DEFAULT '{}', "is_deleted" boolean NOT NULL DEFAULT false, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(500) NOT NULL, "jti" character varying(100) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_revoked" boolean NOT NULL DEFAULT false, "user_agent" character varying(500), "device_id" character varying(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1" UNIQUE ("token_hash"), CONSTRAINT "UQ_f3752400c98d5c0b3dca54d66d5" UNIQUE ("jti"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f3752400c98d5c0b3dca54d66d" ON "refresh_tokens" ("jti") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_14187aa4d2d58318c82c62c7ea" ON "refresh_tokens" ("user_id", "is_revoked") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "avatar_url" character varying(500), "preferences" jsonb DEFAULT '{}', "settings" jsonb DEFAULT '{}', "role" character varying(20) NOT NULL DEFAULT 'user', "status" character varying(20) NOT NULL DEFAULT 'active', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_login_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );

    // Add unique case-insensitive email index
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" (LOWER(email))`,
    );
    await queryRunner.query(
      `CREATE TABLE "job_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "schema" jsonb DEFAULT '{}', "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e7b3320f76c8a9f4e73dbb191d7" UNIQUE ("name"), CONSTRAINT "PK_87d4226cb676b3b16518977cc7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "prompt_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "job_type_id" uuid NOT NULL, "template" text NOT NULL, "version" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d8621cc428ff586db3e3a8f5b74" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4e1aab2b7dde83466b3b2796b7" ON "prompt_templates" ("job_type_id", "version") `,
    );
    // Add foreign keys with ON UPDATE CASCADE for referential integrity
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_69e9c31b030eeceeb02e5c21788" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_9b4bbe214d440be9d0b338045d3" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD CONSTRAINT "FK_bbe94b35f09a29d183d34ad51e4" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" ADD CONSTRAINT "FK_32f8c25a5ce0e33674e1253411e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_templates" ADD CONSTRAINT "FK_fb46d153a886bc77a28fa43e29b" FOREIGN KEY ("job_type_id") REFERENCES "job_types"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prompt_templates" DROP CONSTRAINT "FK_fb46d153a886bc77a28fa43e29b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" DROP CONSTRAINT "FK_32f8c25a5ce0e33674e1253411e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings" DROP CONSTRAINT "FK_bbe94b35f09a29d183d34ad51e4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_9b4bbe214d440be9d0b338045d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP CONSTRAINT "FK_69e9c31b030eeceeb02e5c21788"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4e1aab2b7dde83466b3b2796b7"`,
    );
    await queryRunner.query(`DROP TABLE "prompt_templates"`);
    await queryRunner.query(`DROP TABLE "job_types"`);
    await queryRunner.query(`DROP INDEX "public"."users_email_lower_idx"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_14187aa4d2d58318c82c62c7ea"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f3752400c98d5c0b3dca54d66d"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "plans"`);
    await queryRunner.query(`DROP INDEX "public"."embeddings_vector_idx"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dadabd28e625b8b7e1c6258f08"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6c70ccc40fb83cb822fa87c15e"`,
    );
    await queryRunner.query(`DROP TABLE "embeddings"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8584a1974e1ca95f4861d975ff"`,
    );
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP INDEX "public"."jobs_open_idx"`);
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP CONSTRAINT "jobs_state_check"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_11e79fa7801c3e7ffa3edbeca4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0ed03016155c25246d094d1898"`,
    );
    await queryRunner.query(`DROP TABLE "jobs"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }
}
