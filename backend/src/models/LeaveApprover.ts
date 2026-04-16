import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class LeaveApprover extends Model {
  declare id: number;
  declare leaveRequestId: number;
  declare approverId: number;
  declare orderIndex: number;
  declare status: string;
  declare note: string | null;
  declare reviewedAt: Date | null;
  declare createdAt: Date;
}

LeaveApprover.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    leaveRequestId: { type: DataTypes.INTEGER, allowNull: false, field: "leave_request_id" },
    approverId: { type: DataTypes.INTEGER, allowNull: false, field: "approver_id" },
    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "order_index" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending" },
    note: { type: DataTypes.TEXT },
    reviewedAt: { type: DataTypes.DATE, field: "reviewed_at" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "leave_approvers", timestamps: false }
);

export default LeaveApprover;
