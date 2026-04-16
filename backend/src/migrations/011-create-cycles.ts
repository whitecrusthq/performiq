import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cycle_status') THEN CREATE TYPE cycle_status AS ENUM ('draft', 'active', 'closed'); END IF; END $$;
      CREATE TABLE IF NOT EXISTS cycles (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
        status cycle_status NOT NULL DEFAULT 'draft', created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS cycles; DROP TYPE IF EXISTS cycle_status;`);
    },
  };
  