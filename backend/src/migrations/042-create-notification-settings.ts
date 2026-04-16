import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS notification_settings (
        id SERIAL PRIMARY KEY, platform TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT false,
        config JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_by_id TEXT
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS notification_settings;`);
    },
  };
  