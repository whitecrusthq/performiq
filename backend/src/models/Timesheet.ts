import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class Timesheet extends Model {
  declare id: number;
  declare userId: number;
  declare weekStart: string;
  declare weekEnd: string;
  declare totalMinutes: number;
  declare status: string;
  declare submittedAt: Date | null;
  declare approvedBy: number | null;
  declare approvedAt: Date | null;
  declare rejectedBy: number | null;
  declare rejectedAt: Date | null;
  declare notes: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Timesheet.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    weekStart: { type: DataTypes.DATEONLY, allowNull: false, field: "week_start" },
    weekEnd: { type: DataTypes.DATEONLY, allowNull: false, field: "week_end" },
    totalMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "total_minutes" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "draft" },
    submittedAt: { type: DataTypes.DATE, field: "submitted_at" },
    approvedBy: { type: DataTypes.INTEGER, field: "approved_by" },
    approvedAt: { type: DataTypes.DATE, field: "approved_at" },
    rejectedBy: { type: DataTypes.INTEGER, field: "rejected_by" },
    rejectedAt: { type: DataTypes.DATE, field: "rejected_at" },
    notes: { type: DataTypes.TEXT },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "timesheets", timestamps: false }
);

export default Timesheet;
