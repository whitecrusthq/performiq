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
}

export default sequelize;
