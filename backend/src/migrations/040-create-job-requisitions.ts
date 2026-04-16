import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN CREATE TYPE job_status AS ENUM ('draft','open','on_hold','closed','filled'); END IF; END $$;
      CREATE TABLE IF NOT EXISTS job_requisitions (
        id SERIAL PRIMARY KEY, title TEXT NOT NULL, department TEXT,
        site_id INTEGER REFERENCES sites(id), description TEXT, requirements TEXT,
        employment_type TEXT NOT NULL DEFAULT 'full_time', status job_status NOT NULL DEFAULT 'draft',
        openings INTEGER NOT NULL DEFAULT 1, hiring_manager_id INTEGER REFERENCES users(id),
        created_by_id INTEGER NOT NULL REFERENCES users(id), closing_date DATE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS job_requisitions; DROP TYPE IF EXISTS job_status;`);
    },
  };
  