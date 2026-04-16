import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS leave_policies (
        id SERIAL PRIMARY KEY, leave_type TEXT NOT NULL, days_allocated INTEGER NOT NULL DEFAULT 0,
        cycle_mode TEXT NOT NULL DEFAULT 'dates', cycle_start_month INTEGER NOT NULL DEFAULT 1,
        cycle_start_day INTEGER NOT NULL DEFAULT 1, cycle_end_month INTEGER NOT NULL DEFAULT 12,
        cycle_end_day INTEGER NOT NULL DEFAULT 31, cycle_days INTEGER NOT NULL DEFAULT 365,
        rollover_enabled BOOLEAN NOT NULL DEFAULT false, max_rollover_days INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS leave_policies;`);
    },
  };
  