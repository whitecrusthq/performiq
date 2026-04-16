import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timesheet_status') THEN CREATE TYPE timesheet_status AS ENUM ('draft','submitted','approved','rejected'); END IF; END $$;
      CREATE TABLE IF NOT EXISTS timesheets (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, week_start DATE NOT NULL, week_end DATE NOT NULL,
        total_minutes INTEGER NOT NULL DEFAULT 0, status timesheet_status NOT NULL DEFAULT 'draft',
        submitted_at TIMESTAMP, approved_by INTEGER, approved_at TIMESTAMP, rejected_by INTEGER, rejected_at TIMESTAMP,
        notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS timesheets; DROP TYPE IF EXISTS timesheet_status;`);
    },
  };
  