import { MigrationInterface, QueryRunner } from "typeorm";

export class FixMessagesIndexAndConversationCheck1763106034279
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing messages index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_5deeed58d981db539765baebd5"`,
    );

    // Create new index matching query pattern: (conversation_id, is_deleted, created_at, id)
    await queryRunner.query(
      `CREATE INDEX "idx_messages_conversation_filter_sort" ON "messages" ("conversation_id", "is_deleted", "created_at", "id")`,
    );

    // Add CHECK constraint to ensure message_count is non-negative
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "conversations_message_count_check" CHECK (message_count >= 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove CHECK constraint
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_message_count_check"`,
    );

    // Drop new index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_messages_conversation_filter_sort"`,
    );

    // Recreate old index
    await queryRunner.query(
      `CREATE INDEX "IDX_5deeed58d981db539765baebd5" ON "messages" ("conversation_id", "created_at", "id")`,
    );
  }
}
