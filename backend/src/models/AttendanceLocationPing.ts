import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class AttendanceLocationPing extends Model {
  declare id: number;
  declare attendanceLogId: number;
  declare userId: number;
  declare lat: string;
  declare lng: string;
  declare recordedAt: Date;
}

AttendanceLocationPing.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    attendanceLogId: { type: DataTypes.INTEGER, allowNull: false, field: "attendance_log_id" },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    recordedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "recorded_at" },
  },
  { sequelize, tableName: "attendance_location_pings", timestamps: false }
);

export default AttendanceLocationPing;
