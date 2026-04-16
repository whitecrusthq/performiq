import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS template_tasks (
        id SERIAL PRIMARY KEY, template_id INTEGER NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
        title TEXT NOT NULL, description TEXT, category TEXT, order_index INTEGER NOT NULL DEFAULT 0,
        default_assignee_role TEXT, due_in_days INTEGER, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS template_tasks;`);
    },
  };
  