import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class TimesheetEntry extends Model {
  declare id: number;
  declare timesheetId: number;
  declare userId: number;
  declare date: string;
  declare minutes: number;
  declare notes: string | null;
  declare createdAt: Date;
}

TimesheetEntry.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    timesheetId: { type: DataTypes.INTEGER, allowNull: false, field: "timesheet_id" },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    notes: { type: DataTypes.TEXT },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "timesheet_entries", timestamps: false }
);

export default TimesheetEntry;
