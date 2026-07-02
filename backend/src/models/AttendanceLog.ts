import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class AttendanceLog extends Model {
  declare id: number;
  declare userId: number;
  declare date: string;
  declare siteId: number | null;
  declare clockIn: Date | null;
  declare clockOut: Date | null;
  declare durationMinutes: number | null;
  declare clockInLat: string | null;
  declare clockInLng: string | null;
  declare clockOutLat: string | null;
  declare clockOutLng: string | null;
  declare faceImageIn: string | null;
  declare faceImageOut: string | null;
  declare clockInPhotoTime: Date | null;
  declare clockOutPhotoTime: Date | null;
  declare notes: string | null;
  declare shiftType: string | null;
  declare clockOutSource: string;
  declare autoClockedOut: boolean;
  declare clockOutLocationTime: Date | null;
  declare expectedClockOut: Date | null;
  declare faceReviewStatus: string | null;
  declare faceReviewedBy: number | null;
  declare faceReviewedAt: Date | null;
  declare createdAt: Date;
}

AttendanceLog.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    siteId: { type: DataTypes.INTEGER, field: "site_id" },
    clockIn: { type: DataTypes.DATE, field: "clock_in" },
    clockOut: { type: DataTypes.DATE, field: "clock_out" },
    durationMinutes: { type: DataTypes.INTEGER, field: "duration_minutes" },
    clockInLat: { type: DataTypes.DECIMAL(10, 7), field: "clock_in_lat" },
    clockInLng: { type: DataTypes.DECIMAL(10, 7), field: "clock_in_lng" },
    clockOutLat: { type: DataTypes.DECIMAL(10, 7), field: "clock_out_lat" },
    clockOutLng: { type: DataTypes.DECIMAL(10, 7), field: "clock_out_lng" },
    faceImageIn: { type: DataTypes.TEXT, field: "face_image_in" },
    faceImageOut: { type: DataTypes.TEXT, field: "face_image_out" },
    clockInPhotoTime: { type: DataTypes.DATE, field: "clock_in_photo_time" },
    clockOutPhotoTime: { type: DataTypes.DATE, field: "clock_out_photo_time" },
    notes: { type: DataTypes.TEXT },
    shiftType: { type: DataTypes.TEXT, field: "shift_type" },
    clockOutSource: { type: DataTypes.TEXT, allowNull: false, defaultValue: "manual", field: "clock_out_source" },
    autoClockedOut: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "auto_clocked_out" },
    clockOutLocationTime: { type: DataTypes.DATE, field: "clock_out_location_time" },
    expectedClockOut: { type: DataTypes.DATE, field: "expected_clock_out" },
    faceReviewStatus: { type: DataTypes.TEXT, defaultValue: "pending", field: "face_review_status" },
    faceReviewedBy: { type: DataTypes.INTEGER, field: "face_reviewed_by" },
    faceReviewedAt: { type: DataTypes.DATE, field: "face_reviewed_at" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "attendance_logs", timestamps: false }
);

export default AttendanceLog;
