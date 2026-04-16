import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS appraisal_scores (
        id SERIAL PRIMARY KEY, appraisal_id INTEGER NOT NULL, criterion_id INTEGER NOT NULL,
        self_score NUMERIC(5,2), manager_score NUMERIC(5,2), self_note TEXT, manager_note TEXT,
        actual_value NUMERIC(15,2), admin_actual_value NUMERIC(15,2), accepted_value TEXT, budget_value NUMERIC(15,2)
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS appraisal_scores;`);
    },
  };
  