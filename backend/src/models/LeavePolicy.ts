import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class LeavePolicy extends Model {
  declare id: number;
  declare leaveType: string;
  declare daysAllocated: number;
  declare cycleMode: string;
  declare cycleStartMonth: number;
  declare cycleStartDay: number;
  declare cycleEndMonth: number;
  declare cycleEndDay: number;
  declare cycleDays: number;
  declare rolloverEnabled: boolean;
  declare maxRolloverDays: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

LeavePolicy.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    leaveType: { type: DataTypes.TEXT, allowNull: false, field: "leave_type" },
    daysAllocated: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "days_allocated" },
    cycleMode: { type: DataTypes.TEXT, allowNull: false, defaultValue: "dates", field: "cycle_mode" },
    cycleStartMonth: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: "cycle_start_month" },
    cycleStartDay: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: "cycle_start_day" },
    cycleEndMonth: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 12, field: "cycle_end_month" },
    cycleEndDay: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 31, field: "cycle_end_day" },
    cycleDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 365, field: "cycle_days" },
    rolloverEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "rollover_enabled" },
    maxRolloverDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "max_rollover_days" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "leave_policies", timestamps: false }
);

export default LeavePolicy;
