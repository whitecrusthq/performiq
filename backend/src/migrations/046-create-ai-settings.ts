import { QueryInterface } from "sequelize";

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS ai_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        provider TEXT NOT NULL DEFAULT 'gemini',
        api_key TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS ai_settings;`);
  },
};
