import { QueryInterface } from "sequelize";

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE sites ADD COLUMN IF NOT EXISTS category TEXT;
      CREATE INDEX IF NOT EXISTS idx_sites_category ON sites (category);
    `);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_sites_category;
      ALTER TABLE sites DROP COLUMN IF EXISTS category;
    `);
  },
};
