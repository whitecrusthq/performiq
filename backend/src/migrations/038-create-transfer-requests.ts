import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_status') THEN CREATE TYPE transfer_status AS ENUM ('pending','approved','rejected','cancelled'); END IF; END $$;
      CREATE TABLE IF NOT EXISTS transfer_requests (
        id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        from_site_id INTEGER REFERENCES sites(id), to_site_id INTEGER NOT NULL REFERENCES sites(id),
        from_department TEXT, to_department TEXT, reason TEXT NOT NULL, effective_date TEXT NOT NULL,
        end_date TEXT, status transfer_status NOT NULL DEFAULT 'pending',
        requested_by_id INTEGER NOT NULL REFERENCES users(id), approved_by_id INTEGER REFERENCES users(id),
        approval_notes TEXT, approved_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS transfer_requests; DROP TYPE IF EXISTS transfer_status;`);
    },
  };
  