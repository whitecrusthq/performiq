import { QueryInterface } from "sequelize";

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
    `);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE app_settings DROP COLUMN IF EXISTS logo_url;
    `);
  },
};
