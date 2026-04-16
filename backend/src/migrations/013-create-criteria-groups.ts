import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS criteria_groups (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS criteria_group_items (
        id SERIAL PRIMARY KEY, group_id INTEGER NOT NULL, criterion_id INTEGER NOT NULL
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS criteria_group_items; DROP TABLE IF EXISTS criteria_groups;`);
    },
  };
  