import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS storage_providers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await queryInterface.sequelize.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_providers_one_default ON storage_providers ((TRUE)) WHERE is_default = TRUE;`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS storage_providers;`);
}
