import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS timesheet_entries (
        id SERIAL PRIMARY KEY, timesheet_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
        date DATE NOT NULL, minutes INTEGER NOT NULL DEFAULT 0, notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS timesheet_entries;`);
    },
  };
  