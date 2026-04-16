import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class TimesheetApprover extends Model {
  declare id: number;
  declare timesheetId: number;
  declare approverId: number;
  declare orderIndex: number;
  declare status: string;
  declare note: string | null;
  declare reviewedAt: Date | null;
  declare createdAt: Date;
}

TimesheetApprover.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    timesheetId: { type: DataTypes.INTEGER, allowNull: false, field: "timesheet_id" },
    approverId: { type: DataTypes.INTEGER, allowNull: false, field: "approver_id" },
    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "order_index" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending" },
    note: { type: DataTypes.TEXT },
    reviewedAt: { type: DataTypes.DATE, field: "reviewed_at" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "timesheet_approvers", timestamps: false }
);

export default TimesheetApprover;
