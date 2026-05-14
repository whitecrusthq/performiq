import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `CREATE TABLE IF NOT EXISTS hr_kb_documents (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source_filename TEXT,
      tags TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  );
  await queryInterface.sequelize.query(
    `CREATE INDEX IF NOT EXISTS hr_kb_documents_created_at_idx ON hr_kb_documents (created_at DESC);`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS hr_kb_documents;`);
}
