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
  declare coverUser1Status: string;
  declare coverUser1RespondedAt: Date | null;
  declare coverUser1Note: string | null;
  declare coverUser2Status: string;
  declare coverUser2RespondedAt: Date | null;
  declare coverUser2Note: string | null;
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
    coverUser1Status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending", field: "cover_user_1_status" },
    coverUser1RespondedAt: { type: DataTypes.DATE, field: "cover_user_1_responded_at" },
    coverUser1Note: { type: DataTypes.TEXT, field: "cover_user_1_note" },
    coverUser2Status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending", field: "cover_user_2_status" },
    coverUser2RespondedAt: { type: DataTypes.DATE, field: "cover_user_2_responded_at" },
    coverUser2Note: { type: DataTypes.TEXT, field: "cover_user_2_note" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "leave_requests", timestamps: false }
);

export default LeaveRequest;
