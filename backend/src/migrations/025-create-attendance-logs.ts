import { QueryInterface } from "sequelize";

  export default {
    async up(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS attendance_logs (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, date DATE NOT NULL, site_id INTEGER,
        clock_in TIMESTAMP, clock_out TIMESTAMP, duration_minutes INTEGER,
        clock_in_lat DECIMAL(10,7), clock_in_lng DECIMAL(10,7), clock_out_lat DECIMAL(10,7), clock_out_lng DECIMAL(10,7),
        face_image_in TEXT, face_image_out TEXT, clock_in_photo_time TIMESTAMP, clock_out_photo_time TIMESTAMP,
        notes TEXT, face_review_status TEXT DEFAULT 'pending', face_reviewed_by INTEGER, face_reviewed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );`);
    },

    async down(queryInterface: QueryInterface) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS attendance_logs;`);
    },
  };
  