import { QueryInterface } from "sequelize";

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
        ADD COLUMN IF NOT EXISTS two_factor_pending_secret TEXT,
        ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE security_settings
        ADD COLUMN IF NOT EXISTS enforce_2fa_all BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS enforce_2fa_roles TEXT;
    `);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS two_factor_secret,
        DROP COLUMN IF EXISTS two_factor_pending_secret,
        DROP COLUMN IF EXISTS two_factor_enabled,
        DROP COLUMN IF EXISTS two_factor_backup_codes;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE security_settings
        DROP COLUMN IF EXISTS enforce_2fa_all,
        DROP COLUMN IF EXISTS enforce_2fa_roles;
    `);
  },
};
