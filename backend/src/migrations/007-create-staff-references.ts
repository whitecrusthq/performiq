import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS staff_references (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ref_number INTEGER NOT NULL DEFAULT 1, name TEXT, address TEXT, occupation TEXT,
        age TEXT, telephone TEXT, email TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS staff_references;`);
    },
  };
  