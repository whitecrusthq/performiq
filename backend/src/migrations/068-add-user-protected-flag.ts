import { QueryInterface } from "sequelize";

/**
 * Protected accounts: a super admin can lock specific users so that only a
 * super admin can view them in lists or edit/disable/delete them.
 */
export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE users DROP COLUMN IF EXISTS is_protected;
  `);
}
