import { MigrationInterface, QueryRunner } from "typeorm";

export class Setup1762961012420 implements MigrationInterface {
  name = "Setup1762961012420";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP CONSTRAINT "FK_69e9c31b030eeceeb02e5c21788"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_9b4bbe214d440be9d0b338045d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings" DROP CONSTRAINT "FK_bbe94b35f09a29d183d34ad51e4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" DROP CONSTRAINT "FK_32f8c25a5ce0e33674e1253411e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_templates" DROP CONSTRAINT "FK_fb46d153a886bc77a28fa43e29b"`,
    );
    await queryRunner.query(`DROP INDEX "public"."jobs_open_idx"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8584a1974e1ca95f4861d975ff"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_messages_conversation_time"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ux_conversations_plan_default"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_conversations_plan_activity"`,
    );
    await queryRunner.query(`DROP INDEX "public"."embeddings_vector_idx"`);
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP CONSTRAINT "jobs_state_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "messages_role_chk"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0ed03016155c25246d094d1898"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ALTER COLUMN "params" DROP DEFAULT`,
    );
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "state"`);
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD "state" character varying(20) NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "title"`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "title" character varying(255)`,
    );
    await queryRunner.query(`ALTER TABLE "embeddings" DROP COLUMN "vector"`);
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD "vector" vector NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "title"`);
    await queryRunner.query(
      `ALTER TABLE "plans" ADD "title" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" ALTER COLUMN "metadata" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN "token_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD "token_hash" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1" UNIQUE ("token_hash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "preferences" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "settings" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_types" ALTER COLUMN "schema" DROP DEFAULT`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0ed03016155c25246d094d1898" ON "jobs" ("plan_id", "state") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5deeed58d981db539765baebd5" ON "messages" ("conversation_id", "created_at", "id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9185e4a10f53167d15f23e1720" ON "conversations" ("last_message_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_63640f745360a057d8d43f99da" ON "conversations" ("plan_id", "is_deleted", "last_message_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_32f8c25a5ce0e33674e1253411" ON "plans" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_69e9c31b030eeceeb02e5c21788" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_9b4bbe214d440be9d0b338045d3" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD CONSTRAINT "FK_bbe94b35f09a29d183d34ad51e4" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" ADD CONSTRAINT "FK_32f8c25a5ce0e33674e1253411e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_templates" ADD CONSTRAINT "FK_fb46d153a886bc77a28fa43e29b" FOREIGN KEY ("job_type_id") REFERENCES "job_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
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
      `DROP INDEX "public"."IDX_32f8c25a5ce0e33674e1253411"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_63640f745360a057d8d43f99da"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9185e4a10f53167d15f23e1720"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5deeed58d981db539765baebd5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0ed03016155c25246d094d1898"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_types" ALTER COLUMN "schema" SET DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "settings" SET DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "preferences" SET DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN "token_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD "token_hash" character varying(500) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1" UNIQUE ("token_hash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" ALTER COLUMN "metadata" SET DEFAULT '{}'`,
    );
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "title"`);
    await queryRunner.query(
      `ALTER TABLE "plans" ADD "title" character varying(500) NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "embeddings" DROP COLUMN "vector"`);
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD "vector" vector(1536) NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "title"`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "title" character varying(500) NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "state"`);
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD "state" character varying(50) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ALTER COLUMN "params" SET DEFAULT '{}'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0ed03016155c25246d094d1898" ON "jobs" ("plan_id", "state") `,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "messages_role_chk" CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'assistant'::character varying])::text[])))`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "jobs_state_check" CHECK (((state)::text = ANY ((ARRAY['queued'::character varying, 'pending'::character varying, 'processing'::character varying, 'retrying'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))`,
    );
    await queryRunner.query(
      `CREATE INDEX "embeddings_vector_idx" ON "embeddings" ("vector") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conversations_plan_activity" ON "conversations" ("plan_id", "is_deleted", "last_message_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_conversations_plan_default" ON "conversations" ("plan_id") WHERE ((is_default = true) AND (is_deleted = false))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_messages_conversation_time" ON "messages" ("id", "conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8584a1974e1ca95f4861d975ff" ON "messages" ("conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "jobs_open_idx" ON "jobs" ("plan_id", "state") WHERE ((state)::text = ANY ((ARRAY['queued'::character varying, 'pending'::character varying, 'processing'::character varying, 'retrying'::character varying])::text[]))`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_templates" ADD CONSTRAINT "FK_fb46d153a886bc77a28fa43e29b" FOREIGN KEY ("job_type_id") REFERENCES "job_types"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" ADD CONSTRAINT "FK_32f8c25a5ce0e33674e1253411e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD CONSTRAINT "FK_bbe94b35f09a29d183d34ad51e4" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_9b4bbe214d440be9d0b338045d3" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_69e9c31b030eeceeb02e5c21788" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );
  }
}
