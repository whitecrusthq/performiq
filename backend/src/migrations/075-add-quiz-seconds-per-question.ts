import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    "ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS quiz_seconds_per_question INTEGER NOT NULL DEFAULT 0;"
  );
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query("ALTER TABLE app_settings DROP COLUMN IF EXISTS quiz_seconds_per_question;");
}
