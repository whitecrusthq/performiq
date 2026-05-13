import { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;`
  );
  await queryInterface.sequelize.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE NULL;`
  );
  await queryInterface.sequelize.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT NULL;`
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`ALTER TABLE users DROP COLUMN IF EXISTS deactivation_reason;`);
  await queryInterface.sequelize.query(`ALTER TABLE users DROP COLUMN IF EXISTS deactivated_at;`);
  await queryInterface.sequelize.query(`ALTER TABLE users DROP COLUMN IF EXISTS is_active;`);
}
