import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_status') THEN CREATE TYPE goal_status AS ENUM ('not_started','in_progress','completed','cancelled'); END IF; END $$;
      CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, cycle_id INTEGER, title TEXT NOT NULL,
        description TEXT, status goal_status NOT NULL DEFAULT 'not_started', due_date DATE,
        progress INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS goals; DROP TYPE IF EXISTS goal_status;`);
    },
  };
  