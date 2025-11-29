import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConversationConstraints1762697202800
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add conversation metadata fields
    await queryRunner.query(`
      ALTER TABLE conversations 
        ADD COLUMN is_default BOOLEAN DEFAULT false NOT NULL,
        ADD COLUMN last_message_at TIMESTAMPTZ,
        ADD COLUMN message_count INTEGER DEFAULT 0 NOT NULL
    `);

    // Partial unique index: one default per plan
    await queryRunner.query(`
      CREATE UNIQUE INDEX ux_conversations_plan_default
        ON conversations(plan_id)
        WHERE is_default = true AND is_deleted = false
    `);

    // Performance indexes
    await queryRunner.query(`
      CREATE INDEX idx_conversations_plan_activity 
        ON conversations(plan_id, is_deleted, last_message_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_messages_conversation_time 
        ON messages(conversation_id, created_at ASC, id ASC)
    `);

    // Message role constraint (DB-level safety)
    await queryRunner.query(`
      ALTER TABLE messages
        ADD CONSTRAINT messages_role_chk
        CHECK (role IN ('user', 'assistant'))
    `);

    // Add audit field to messages (SAFE migration for existing data)
    // Step 1: Add as nullable
    await queryRunner.query(`
      ALTER TABLE messages ADD COLUMN created_by UUID
    `);

    // Step 2: Backfill existing rows (if any messages exist)
    await queryRunner.query(`
      UPDATE messages m 
      SET created_by = (
        SELECT p.user_id 
        FROM conversations c 
        JOIN plans p ON c.plan_id = p.id 
        WHERE c.id = m.conversation_id
      )
      WHERE created_by IS NULL
    `);

    // Step 3: Set NOT NULL after backfill
    await queryRunner.query(`
      ALTER TABLE messages ALTER COLUMN created_by SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove created_by from messages
    await queryRunner.query(`
      ALTER TABLE messages DROP COLUMN created_by
    `);

    // Remove message role constraint
    await queryRunner.query(`
      ALTER TABLE messages DROP CONSTRAINT messages_role_chk
    `);

    // Remove indexes
    await queryRunner.query(`
      DROP INDEX idx_messages_conversation_time
    `);

    await queryRunner.query(`
      DROP INDEX idx_conversations_plan_activity
    `);

    await queryRunner.query(`
      DROP INDEX ux_conversations_plan_default
    `);

    // Remove conversation metadata fields
    await queryRunner.query(`
      ALTER TABLE conversations 
        DROP COLUMN message_count,
        DROP COLUMN last_message_at,
        DROP COLUMN is_default
    `);
  }
}
