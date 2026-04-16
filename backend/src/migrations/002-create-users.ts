import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN CREATE TYPE role AS ENUM ('super_admin', 'admin', 'manager', 'employee'); END IF; END $$;
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role role NOT NULL DEFAULT 'employee',
        custom_role_id INTEGER,
        manager_id INTEGER,
        site_id INTEGER,
        department TEXT,
        job_title TEXT,
        phone TEXT,
        staff_id TEXT,
        profile_photo TEXT,
        is_locked BOOLEAN NOT NULL DEFAULT false,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        surname TEXT, first_name TEXT, middle_name TEXT,
        address TEXT, permanent_address TEXT, permanent_city TEXT, permanent_state TEXT, permanent_country TEXT, permanent_postal_code TEXT,
        temporary_address TEXT, temporary_city TEXT, temporary_state TEXT, temporary_country TEXT, temporary_postal_code TEXT,
        city TEXT, state_province TEXT, country TEXT, postal_code TEXT,
        date_of_birth DATE, gender TEXT, marital_status TEXT, maiden_name TEXT, religion TEXT, state_of_origin TEXT, nationality TEXT, national_id TEXT, hobbies TEXT,
        spouse_name TEXT, spouse_occupation TEXT, number_of_children INTEGER, wedding_date DATE,
        start_date DATE, probation_end_date DATE, probation_status TEXT,
        emergency_contact_name TEXT, emergency_contact_phone TEXT, emergency_contact_relation TEXT, emergency_contact_address TEXT,
        bank_name TEXT, bank_branch TEXT, bank_account_number TEXT, bank_account_name TEXT,
        tax_id TEXT, pension_id TEXT, pfa_name TEXT, rsa_pin TEXT, hmo TEXT, notes TEXT
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS users; DROP TYPE IF EXISTS role;`);
    },
  };
  