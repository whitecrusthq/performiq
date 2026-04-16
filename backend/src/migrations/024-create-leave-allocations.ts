import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS leave_allocations (
        id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL, leave_type TEXT NOT NULL,
        policy_id INTEGER, allocated INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0,
        cycle_year INTEGER NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS leave_allocations;`);
    },
  };
  