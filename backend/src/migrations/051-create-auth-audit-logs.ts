import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `CREATE TABLE IF NOT EXISTS auth_audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      event TEXT NOT NULL,
      failure_reason TEXT,
      ip_address TEXT,
      user_agent TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  );
  await queryInterface.sequelize.query(
    `CREATE INDEX IF NOT EXISTS auth_audit_logs_created_at_idx ON auth_audit_logs (created_at DESC);`
  );
  await queryInterface.sequelize.query(
    `CREATE INDEX IF NOT EXISTS auth_audit_logs_user_id_idx ON auth_audit_logs (user_id);`
  );
  await queryInterface.sequelize.query(
    `CREATE INDEX IF NOT EXISTS auth_audit_logs_event_idx ON auth_audit_logs (event);`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS auth_audit_logs;`);
}
