import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN NOT NULL DEFAULT FALSE;`
  );
  await queryInterface.sequelize.query(
    `ALTER TABLE sites ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN NOT NULL DEFAULT FALSE;`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`ALTER TABLE users DROP COLUMN IF EXISTS require_2fa;`);
  await queryInterface.sequelize.query(`ALTER TABLE sites DROP COLUMN IF EXISTS require_2fa;`);
}
