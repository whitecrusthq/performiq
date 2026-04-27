import { QueryInterface } from "sequelize";

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'Other',
        object_path TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER,
        original_filename TEXT,
        quiz_source_text TEXT,
        uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);

      CREATE TABLE IF NOT EXISTS document_questions (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        choices JSONB NOT NULL,
        correct_index INTEGER NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_document_questions_doc ON document_questions(document_id);
    `);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS document_questions;
      DROP TABLE IF EXISTS documents;
    `);
  },
};
