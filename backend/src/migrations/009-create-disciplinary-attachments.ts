import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS disciplinary_attachments (
        id SERIAL PRIMARY KEY, record_id INTEGER NOT NULL REFERENCES disciplinary_records(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL, file_type TEXT NOT NULL, object_path TEXT NOT NULL,
        uploaded_by_id INTEGER, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS disciplinary_attachments;`);
    },
  };
  