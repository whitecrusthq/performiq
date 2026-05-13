import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TABLE security_settings ADD COLUMN IF NOT EXISTS idle_timeout_minutes INTEGER NOT NULL DEFAULT 30;`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TABLE security_settings DROP COLUMN IF EXISTS idle_timeout_minutes;`
  );
}
