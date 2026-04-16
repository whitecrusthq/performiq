import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, address TEXT, city TEXT,
        region TEXT, country TEXT, description TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS sites;`);
    },
  };
  