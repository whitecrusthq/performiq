import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_task_status') THEN CREATE TYPE hr_task_status AS ENUM ('pending','in_progress','completed','skipped'); END IF; END $$;
      CREATE TABLE IF NOT EXISTS workflow_tasks (
        id SERIAL PRIMARY KEY, workflow_id INTEGER NOT NULL REFERENCES onboarding_workflows(id) ON DELETE CASCADE,
        title TEXT NOT NULL, description TEXT, category TEXT, order_index INTEGER NOT NULL DEFAULT 0,
        status hr_task_status NOT NULL DEFAULT 'pending', assignee_id INTEGER REFERENCES users(id),
        due_date TIMESTAMP, completed_at TIMESTAMP, completed_by_id INTEGER REFERENCES users(id),
        notes TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS workflow_tasks; DROP TYPE IF EXISTS hr_task_status;`);
    },
  };
  