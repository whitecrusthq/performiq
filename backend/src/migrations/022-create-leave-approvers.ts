import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS leave_approvers (
        id SERIAL PRIMARY KEY, leave_request_id INTEGER NOT NULL, approver_id INTEGER NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
        note TEXT, reviewed_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS leave_approvers;`);
    },
  };
  