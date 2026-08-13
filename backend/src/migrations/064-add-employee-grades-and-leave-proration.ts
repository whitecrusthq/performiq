import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS employee_grades (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await queryInterface.sequelize.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS grade_id INTEGER REFERENCES employee_grades(id) ON DELETE SET NULL;`
  );
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS leave_type_grades (
      id SERIAL PRIMARY KEY,
      leave_type_id INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
      grade_id INTEGER NOT NULL REFERENCES employee_grades(id) ON DELETE CASCADE,
      UNIQUE (leave_type_id, grade_id)
    );
  `);
  // How entitlement is prorated for employees whose resumption (start) date
  // falls inside the current cycle: none | monthly | monthly_incl
  await queryInterface.sequelize.query(
    `ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS proration_mode TEXT NOT NULL DEFAULT 'none';`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`ALTER TABLE leave_policies DROP COLUMN IF EXISTS proration_mode;`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS leave_type_grades;`);
  await queryInterface.sequelize.query(`ALTER TABLE users DROP COLUMN IF EXISTS grade_id;`);
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS employee_grades;`);
}
