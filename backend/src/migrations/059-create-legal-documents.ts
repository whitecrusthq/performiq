import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS legal_documents (
      id INTEGER PRIMARY KEY DEFAULT 1,
      privacy_content TEXT NOT NULL DEFAULT '',
      privacy_published BOOLEAN NOT NULL DEFAULT FALSE,
      privacy_updated_at TIMESTAMPTZ NULL,
      terms_content TEXT NOT NULL DEFAULT '',
      terms_version INTEGER NOT NULL DEFAULT 0,
      terms_published BOOLEAN NOT NULL DEFAULT FALSE,
      terms_updated_at TIMESTAMPTZ NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await queryInterface.sequelize.query(`
    INSERT INTO legal_documents (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  `);
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS terms_acceptances (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address TEXT NULL
    );
  `);
  await queryInterface.sequelize.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_acceptances_user_version ON terms_acceptances (user_id, version);`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS terms_acceptances;`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS legal_documents;`);
}
