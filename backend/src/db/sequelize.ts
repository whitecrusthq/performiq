import { Sequelize } from "sequelize";
import { logger } from "../lib/logger.js";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const sequelize = new Sequelize(DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")
      ? false
      : { require: true, rejectUnauthorized: false },
  },
  logging: process.env.NODE_ENV === "development"
    ? (msg: string) => logger.debug(msg)
    : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
  logger.info("Database connection established");
  try {
    await sequelize.query(
      `ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMP WITH TIME ZONE NULL;`
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_appraisals_scheduled_start_at ON appraisals (scheduled_start_at) WHERE scheduled_start_at IS NOT NULL;`
    );
    await sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appraisal_status' AND typtype = 'e')
           AND NOT EXISTS (
             SELECT 1 FROM pg_enum e
             JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'appraisal_status' AND e.enumlabel = 'scheduled'
           ) THEN
          ALTER TYPE appraisal_status ADD VALUE 'scheduled';
        END IF;
      END $$;
    `);
  } catch (err) {
    logger.warn({ err }, "scheduled appraisal schema ensure failed (non-fatal)");
  }
  try {
    await sequelize.query(`
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
    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_providers_one_default ON storage_providers ((TRUE)) WHERE is_default = TRUE;`
    );
  } catch (err) {
    logger.warn({ err }, "storage_providers schema ensure failed (non-fatal)");
  }
  try {
    await sequelize.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;`
    );
  } catch (err) {
    logger.warn({ err }, "protected accounts schema ensure failed (non-fatal)");
  }
  try {
    await sequelize.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_code_hash TEXT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP WITH TIME ZONE NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMP WITH TIME ZONE NULL;
    `);
  } catch (err) {
    logger.warn({ err }, "password recovery schema ensure failed (non-fatal)");
  }
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS recovery_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
        expires_at TIMESTAMPTZ NOT NULL, ip_address TEXT, user_agent TEXT,
        recurrence_count INTEGER NOT NULL DEFAULT 1, risk_flag BOOLEAN NOT NULL DEFAULT FALSE,
        elevated BOOLEAN NOT NULL DEFAULT FALSE, resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMPTZ, rejection_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS recovery_requests_one_pending_user ON recovery_requests(user_id) WHERE status = 'pending';
      CREATE INDEX IF NOT EXISTS recovery_requests_status_created_idx ON recovery_requests(status, created_at DESC);
      CREATE TABLE IF NOT EXISTS recovery_audit_logs (
        id SERIAL PRIMARY KEY, request_id INTEGER REFERENCES recovery_requests(id) ON DELETE SET NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, event TEXT NOT NULL, detail TEXT,
        ip_address TEXT, user_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS recovery_audit_user_created_idx ON recovery_audit_logs(user_id, created_at DESC);
    `);
  } catch (err) {
    logger.warn({ err }, "recovery request schema ensure failed (non-fatal)");
  }
  try {
    // Repair legacy and partially edited appraisals that have a scalar
    // reviewer_id but no ordered reviewer row, or a manager-review queue with
    // no active reviewer. This is idempotent and also protects deployments
    // where migrations are not invoked by the start command.
    await sequelize.query(`
      INSERT INTO appraisal_reviewers
        (appraisal_id, reviewer_id, order_index, status, created_at)
      SELECT
        a.id,
        a.reviewer_id,
        0,
        CASE
          WHEN a.status::text = 'manager_review' THEN 'in_progress'
          WHEN a.status::text IN ('pending_approval', 'completed') THEN 'completed'
          ELSE 'pending'
        END,
        NOW()
      FROM appraisals a
      WHERE a.reviewer_id IS NOT NULL
        AND COALESCE(a.workflow_type, 'admin_approval') <> 'self_only'
        AND NOT EXISTS (
          SELECT 1 FROM appraisal_reviewers ar WHERE ar.appraisal_id = a.id
        );

      WITH next_rows AS (
        SELECT DISTINCT ON (ar.appraisal_id) ar.id
        FROM appraisal_reviewers ar
        JOIN appraisals a ON a.id = ar.appraisal_id
        WHERE a.status::text = 'manager_review'
          AND ar.status = 'pending'
          AND NOT EXISTS (
            SELECT 1
            FROM appraisal_reviewers active
            WHERE active.appraisal_id = ar.appraisal_id
              AND active.status = 'in_progress'
          )
        ORDER BY ar.appraisal_id, ar.order_index, ar.id
      )
      UPDATE appraisal_reviewers ar
      SET status = 'in_progress'
      FROM next_rows n
      WHERE ar.id = n.id;
    `);
  } catch (err) {
    logger.warn({ err }, "appraisal reviewer backfill failed (non-fatal)");
  }
}

export default sequelize;
