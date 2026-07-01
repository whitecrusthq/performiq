import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class AttendanceSetting extends Model {
  declare id: number;
  declare daySweepTimes: string[];
  declare nightSweepTimes: string[];
  declare graceMinutes: number;
  declare timezone: string;
}

AttendanceSetting.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    daySweepTimes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: "day_sweep_times" },
    nightSweepTimes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: "night_sweep_times" },
    graceMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "grace_minutes" },
    timezone: { type: DataTypes.TEXT, allowNull: false, defaultValue: "Africa/Lagos" },
  },
  { sequelize, tableName: "attendance_settings", timestamps: false }
);

export default AttendanceSetting;
