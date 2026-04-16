import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL, leave_type TEXT NOT NULL,
        start_date DATE NOT NULL, end_date DATE NOT NULL, days INTEGER NOT NULL,
        reason TEXT, status TEXT NOT NULL DEFAULT 'pending', reviewer_id INTEGER, review_note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS leave_requests;`);
    },
  };
  