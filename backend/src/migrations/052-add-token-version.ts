import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`ALTER TABLE users DROP COLUMN IF EXISTS token_version;`);
}
