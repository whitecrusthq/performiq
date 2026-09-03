import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS recovery_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
      expires_at TIMESTAMPTZ NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      recurrence_count INTEGER NOT NULL DEFAULT 1,
      risk_flag BOOLEAN NOT NULL DEFAULT FALSE,
      elevated BOOLEAN NOT NULL DEFAULT FALSE,
      resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      resolved_at TIMESTAMPTZ,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS recovery_requests_one_pending_user
      ON recovery_requests(user_id) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS recovery_requests_status_created_idx
      ON recovery_requests(status, created_at DESC);
    CREATE TABLE IF NOT EXISTS recovery_audit_logs (
      id SERIAL PRIMARY KEY,
      request_id INTEGER REFERENCES recovery_requests(id) ON DELETE SET NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      event TEXT NOT NULL,
      detail TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS recovery_audit_user_created_idx
      ON recovery_audit_logs(user_id, created_at DESC);
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS recovery_audit_logs; DROP TABLE IF EXISTS recovery_requests;");
}