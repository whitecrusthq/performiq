import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS hr_queries (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general', priority TEXT NOT NULL DEFAULT 'normal',
        status TEXT NOT NULL DEFAULT 'open', assigned_to INTEGER, response TEXT,
        responded_by INTEGER, responded_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS hr_query_messages (
        id SERIAL PRIMARY KEY, query_id INTEGER NOT NULL REFERENCES hr_queries(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS hr_query_messages; DROP TABLE IF EXISTS hr_queries;`);
    },
  };
  