import { QueryInterface } from "sequelize";

/**
 * Replaces the single HR leave approver setting with a configurable list of
 * HR approvers the applicant can choose from for the final approval step.
 */
export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS leave_hr_approvers (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT FALSE
    );
    INSERT INTO leave_hr_approvers (user_id, position)
    SELECT hr_leave_approver_id, 0 FROM app_settings WHERE hr_leave_approver_id IS NOT NULL
    ON CONFLICT DO NOTHING;
    ALTER TABLE app_settings DROP COLUMN IF EXISTS hr_leave_approver_id;
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS leave_hr_approvers;
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS hr_leave_approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);
}
