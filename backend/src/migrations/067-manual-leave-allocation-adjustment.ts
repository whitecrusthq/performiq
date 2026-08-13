import { QueryInterface } from "sequelize";

/**
 * Marks leave allocations that were manually adjusted by an admin so that
 * policy re-saves (which re-prorate everyone) do not overwrite the override.
 */
export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE leave_allocations ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE;
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE leave_allocations DROP COLUMN IF EXISTS is_manual;
  `);
}
