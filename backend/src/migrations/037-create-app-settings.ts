import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        company_name TEXT NOT NULL DEFAULT 'PerformIQ', logo_letter TEXT NOT NULL DEFAULT 'P',
        primary_hsl TEXT NOT NULL DEFAULT '221 83% 53%', theme_name TEXT NOT NULL DEFAULT 'blue',
        login_headline TEXT NOT NULL DEFAULT 'Elevate Your Team''s Performance.',
        login_subtext TEXT NOT NULL DEFAULT 'PerformIQ streamlines appraisals, goals, and feedback into one elegant platform.',
        login_bg_from TEXT NOT NULL DEFAULT '', login_bg_to TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS app_settings;`);
    },
  };
  