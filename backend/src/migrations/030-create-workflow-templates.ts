import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_workflow_type') THEN CREATE TYPE hr_workflow_type AS ENUM ('onboarding','offboarding'); END IF; END $$;
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, type hr_workflow_type NOT NULL,
        description TEXT, is_default BOOLEAN NOT NULL DEFAULT false,
        created_by_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS workflow_templates; DROP TYPE IF EXISTS hr_workflow_type;`);
    },
  };
  