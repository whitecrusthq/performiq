import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS attendance_location_pings (
        id SERIAL PRIMARY KEY, attendance_log_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
        lat DECIMAL(10,7) NOT NULL, lng DECIMAL(10,7) NOT NULL, recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS attendance_location_pings;`);
    },
  };
  