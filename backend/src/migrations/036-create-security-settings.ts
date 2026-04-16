import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS security_settings (
        id SERIAL PRIMARY KEY, lockout_enabled BOOLEAN NOT NULL DEFAULT true,
        max_attempts INTEGER NOT NULL DEFAULT 5, lockout_duration_minutes INTEGER NOT NULL DEFAULT 30,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS security_settings;`);
    },
  };
  