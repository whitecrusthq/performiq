import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS staff_reminders (
        id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL, reminder_type TEXT NOT NULL DEFAULT 'other',
        reminder_date DATE NOT NULL, recurring BOOLEAN NOT NULL DEFAULT true,
        notes TEXT, created_by_id INTEGER, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS staff_reminders;`);
    },
  };
  