import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS notification_admin_recipients (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS notification_admin_recipients;");
}