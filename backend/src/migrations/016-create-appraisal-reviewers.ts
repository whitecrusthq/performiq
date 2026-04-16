import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS appraisal_reviewers (
        id SERIAL PRIMARY KEY, appraisal_id INTEGER NOT NULL, reviewer_id INTEGER NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
        manager_comment TEXT, reviewed_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS appraisal_reviewer_scores (
        id SERIAL PRIMARY KEY, appraisal_id INTEGER NOT NULL, reviewer_id INTEGER NOT NULL,
        criterion_id INTEGER NOT NULL, score NUMERIC(5,2), note TEXT,
        actual_value NUMERIC(15,2), created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS appraisal_reviewer_scores; DROP TABLE IF EXISTS appraisal_reviewers;`);
    },
  };
  