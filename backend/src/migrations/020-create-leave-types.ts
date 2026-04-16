import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS leave_types (
        id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, label VARCHAR(200) NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS leave_types;`);
    },
  };
  