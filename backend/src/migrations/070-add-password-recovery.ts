import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_code_hash TEXT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP WITH TIME ZONE NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMP WITH TIME ZONE NULL;
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE users DROP COLUMN IF EXISTS password_reset_requested_at;
    ALTER TABLE users DROP COLUMN IF EXISTS password_reset_attempts;
    ALTER TABLE users DROP COLUMN IF EXISTS password_reset_expires_at;
    ALTER TABLE users DROP COLUMN IF EXISTS password_reset_code_hash;
    ALTER TABLE users DROP COLUMN IF EXISTS must_change_password;
  `);
}