import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS attendance_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      day_sweep_times JSONB NOT NULL DEFAULT '["17:00","19:00","21:00"]'::jsonb,
      night_sweep_times JSONB NOT NULL DEFAULT '["07:30","08:30"]'::jsonb,
      grace_minutes INTEGER NOT NULL DEFAULT 0,
      timezone TEXT NOT NULL DEFAULT 'Africa/Lagos'
    );
  `);
  await queryInterface.sequelize.query(
    `INSERT INTO attendance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`
  );

  // Schedule config: per-department and per-user (override) shift type + slot.
  await queryInterface.sequelize.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS shift_type TEXT NULL;`);
  await queryInterface.sequelize.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS clock_out_slot TEXT NULL;`);
  await queryInterface.sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS shift_type TEXT NULL;`);
  await queryInterface.sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS clock_out_slot TEXT NULL;`);

  // Attendance record: auto-clock-out audit fields.
  await queryInterface.sequelize.query(`ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS shift_type TEXT NULL;`);
  await queryInterface.sequelize.query(
    `ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS clock_out_source TEXT NOT NULL DEFAULT 'manual';`
  );
  await queryInterface.sequelize.query(
    `ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS auto_clocked_out BOOLEAN NOT NULL DEFAULT FALSE;`
  );
  await queryInterface.sequelize.query(
    `ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS clock_out_location_time TIMESTAMPTZ NULL;`
  );
  await queryInterface.sequelize.query(
    `ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS expected_clock_out TIMESTAMPTZ NULL;`
  );
  await queryInterface.sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_attendance_logs_open ON attendance_logs (user_id) WHERE clock_out IS NULL;`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_attendance_logs_open;`);
  await queryInterface.sequelize.query(`ALTER TABLE attendance_logs DROP COLUMN IF EXISTS expected_clock_out;`);
  await queryInterface.sequelize.query(`ALTER TABLE attendance_logs DROP COLUMN IF EXISTS clock_out_location_time;`);
  await queryInterface.sequelize.query(`ALTER TABLE attendance_logs DROP COLUMN IF EXISTS auto_clocked_out;`);
  await queryInterface.sequelize.query(`ALTER TABLE attendance_logs DROP COLUMN IF EXISTS clock_out_source;`);
  await queryInterface.sequelize.query(`ALTER TABLE attendance_logs DROP COLUMN IF EXISTS shift_type;`);
  await queryInterface.sequelize.query(`ALTER TABLE users DROP COLUMN IF EXISTS clock_out_slot;`);
  await queryInterface.sequelize.query(`ALTER TABLE users DROP COLUMN IF EXISTS shift_type;`);
  await queryInterface.sequelize.query(`ALTER TABLE departments DROP COLUMN IF EXISTS clock_out_slot;`);
  await queryInterface.sequelize.query(`ALTER TABLE departments DROP COLUMN IF EXISTS shift_type;`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS attendance_settings;`);
}
