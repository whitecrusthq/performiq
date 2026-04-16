import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS criteria (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, category TEXT NOT NULL,
        weight NUMERIC(5,2) NOT NULL DEFAULT 1, type TEXT NOT NULL DEFAULT 'rating',
        target_value NUMERIC(15,2), unit TEXT, target_period TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS criteria;`);
    },
  };
  