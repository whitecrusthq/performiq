import { QueryInterface } from "sequelize";

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        document_id INTEGER NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        percent INTEGER NOT NULL,
        passed BOOLEAN NOT NULL DEFAULT FALSE,
        answers JSONB NOT NULL DEFAULT '[]'::jsonb,
        completed_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_doc ON quiz_attempts(document_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed ON quiz_attempts(completed_at DESC);
    `);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS quiz_attempts;`);
  },
};
