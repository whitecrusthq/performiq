import { QueryInterface } from "sequelize";

/**
 * Adds a singleton setting for the designated HR approver who is
 * automatically appended as the final step of every leave approval chain.
 */
export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE app_settings
      ADD COLUMN IF NOT EXISTS hr_leave_approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE app_settings DROP COLUMN IF EXISTS hr_leave_approver_id;
  `);
}
