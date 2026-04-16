import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS confirmation_reviews (
        id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL, appraisal_id INTEGER,
        status TEXT NOT NULL DEFAULT 'pending_appraisal', review_document_path TEXT, review_document_name TEXT,
        reviewer_notes TEXT, initiated_by INTEGER NOT NULL, approved_by INTEGER, rejected_reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS confirmation_reviews;`);
    },
  };
  