import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appraisal_status') THEN CREATE TYPE appraisal_status AS ENUM ('pending','self_review','manager_review','pending_approval','completed'); END IF; END $$;
      DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_type') THEN CREATE TYPE workflow_type AS ENUM ('self_only','manager_review','admin_approval'); END IF; END $$;
      CREATE TABLE IF NOT EXISTS appraisals (
        id SERIAL PRIMARY KEY, cycle_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, reviewer_id INTEGER,
        status appraisal_status NOT NULL DEFAULT 'pending', workflow_type workflow_type NOT NULL DEFAULT 'admin_approval',
        self_comment TEXT, manager_comment TEXT, overall_score NUMERIC(5,2), criteria_group_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS appraisals; DROP TYPE IF EXISTS workflow_type; DROP TYPE IF EXISTS appraisal_status;`);
    },
  };
  