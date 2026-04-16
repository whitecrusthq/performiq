import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS disciplinary_records (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'disciplinary', subject TEXT NOT NULL, description TEXT,
        sanction_applied TEXT, severity TEXT NOT NULL DEFAULT 'minor', incident_date DATE,
        created_by_id INTEGER, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS disciplinary_records;`);
    },
  };
  