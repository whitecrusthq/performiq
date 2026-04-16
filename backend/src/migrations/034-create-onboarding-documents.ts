import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS onboarding_documents (
        id SERIAL PRIMARY KEY, workflow_id INTEGER NOT NULL REFERENCES onboarding_workflows(id) ON DELETE CASCADE,
        name TEXT NOT NULL, file_data TEXT, file_type TEXT, notes TEXT,
        uploaded_by_id INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS onboarding_documents;`);
    },
  };
  