import { QueryInterface } from "sequelize";

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE leave_requests
        ADD COLUMN IF NOT EXISTS cover_user_id_1 INTEGER,
        ADD COLUMN IF NOT EXISTS cover_user_id_2 INTEGER;
    `);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE leave_requests
        DROP COLUMN IF EXISTS cover_user_id_1,
        DROP COLUMN IF EXISTS cover_user_id_2;
    `);
  },
};
