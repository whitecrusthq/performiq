import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS staff_documents (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL,
        document_type TEXT NOT NULL DEFAULT 'other', received_date DATE, notes TEXT,
        uploaded_by_id INTEGER, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS staff_documents;`);
    },
  };
  