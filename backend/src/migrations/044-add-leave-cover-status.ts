import { QueryInterface } from "sequelize";

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE leave_requests
        ADD COLUMN IF NOT EXISTS cover_user_1_status TEXT NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS cover_user_1_responded_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS cover_user_1_note TEXT,
        ADD COLUMN IF NOT EXISTS cover_user_2_status TEXT NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS cover_user_2_responded_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS cover_user_2_note TEXT;
    `);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE leave_requests
        DROP COLUMN IF EXISTS cover_user_1_status,
        DROP COLUMN IF EXISTS cover_user_1_responded_at,
        DROP COLUMN IF EXISTS cover_user_1_note,
        DROP COLUMN IF EXISTS cover_user_2_status,
        DROP COLUMN IF EXISTS cover_user_2_responded_at,
        DROP COLUMN IF EXISTS cover_user_2_note;
    `);
  },
};
