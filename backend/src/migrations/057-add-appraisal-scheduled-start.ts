import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMP WITH TIME ZONE NULL;`
  );
  await queryInterface.sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_appraisals_scheduled_start_at ON appraisals (scheduled_start_at) WHERE scheduled_start_at IS NOT NULL;`
  );
  await queryInterface.sequelize.query(`
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
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_appraisals_scheduled_start_at;`);
  await queryInterface.sequelize.query(`ALTER TABLE appraisals DROP COLUMN IF EXISTS scheduled_start_at;`);
}
