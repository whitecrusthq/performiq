import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_workflow_status') THEN CREATE TYPE hr_workflow_status AS ENUM ('active','completed','cancelled'); END IF; END $$;
      CREATE TABLE IF NOT EXISTS onboarding_workflows (
        id SERIAL PRIMARY KEY, type hr_workflow_type NOT NULL, status hr_workflow_status NOT NULL DEFAULT 'active',
        employee_id INTEGER NOT NULL REFERENCES users(id), template_id INTEGER REFERENCES workflow_templates(id),
        title TEXT NOT NULL, notes TEXT, started_by_id INTEGER NOT NULL REFERENCES users(id),
        start_date TIMESTAMP NOT NULL DEFAULT NOW(), target_completion_date TIMESTAMP, completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS onboarding_workflows; DROP TYPE IF EXISTS hr_workflow_status;`);
    },
  };
  