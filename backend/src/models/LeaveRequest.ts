import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class LeaveRequest extends Model {
  declare id: number;
  declare employeeId: number;
  declare leaveType: string;
  declare startDate: string;
  declare endDate: string;
  declare days: number;
  declare reason: string | null;
  declare status: string;
  declare reviewerId: number | null;
  declare reviewNote: string | null;
  declare coverUserId1: number | null;
  declare coverUserId2: number | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

LeaveRequest.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: "employee_id" },
    leaveType: { type: DataTypes.TEXT, allowNull: false, field: "leave_type" },
    startDate: { type: DataTypes.DATEONLY, allowNull: false, field: "start_date" },
    endDate: { type: DataTypes.DATEONLY, allowNull: false, field: "end_date" },
    days: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.TEXT },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending" },
    reviewerId: { type: DataTypes.INTEGER, field: "reviewer_id" },
    reviewNote: { type: DataTypes.TEXT, field: "review_note" },
    coverUserId1: { type: DataTypes.INTEGER, field: "cover_user_id_1" },
    coverUserId2: { type: DataTypes.INTEGER, field: "cover_user_id_2" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "leave_requests", timestamps: false }
);

export default LeaveRequest;
