import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'candidate_stage') THEN CREATE TYPE candidate_stage AS ENUM ('applied','screening','interview','offer','hired','rejected'); END IF; END $$;
      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY, job_id INTEGER NOT NULL REFERENCES job_requisitions(id) ON DELETE CASCADE,
        first_name TEXT NOT NULL, surname TEXT NOT NULL, email TEXT NOT NULL, phone TEXT,
        resume_text TEXT, cover_letter TEXT, resume_url TEXT, application_token TEXT,
        source TEXT DEFAULT 'manual', address TEXT, city TEXT, experience_years INTEGER,
        current_employer TEXT, current_job_title TEXT, linkedin TEXT, expected_salary TEXT,
        available_start_date DATE, education TEXT,
        stage candidate_stage NOT NULL DEFAULT 'applied', rating INTEGER, notes TEXT,
        interview_date TIMESTAMP, interview_notes TEXT, offer_salary TEXT, offer_notes TEXT,
        rejection_reason TEXT, hired_user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS candidates; DROP TYPE IF EXISTS candidate_stage;`);
    },
  };
  