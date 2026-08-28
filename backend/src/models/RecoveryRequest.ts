import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

export type RecoveryStatus = "pending" | "approved" | "rejected" | "expired";

class RecoveryRequest extends Model {
  declare id: number;
  declare userId: number;
  declare status: RecoveryStatus;
  declare expiresAt: Date;
  declare ipAddress: string | null;
  declare userAgent: string | null;
  declare recurrenceCount: number;
  declare riskFlag: boolean;
  declare elevated: boolean;
  declare resolvedBy: number | null;
  declare resolvedAt: Date | null;
  declare rejectionReason: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

RecoveryRequest.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
  status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending" },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: "expires_at" },
  ipAddress: { type: DataTypes.TEXT, field: "ip_address" },
  userAgent: { type: DataTypes.TEXT, field: "user_agent" },
  recurrenceCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: "recurrence_count" },
  riskFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "risk_flag" },
  elevated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  resolvedBy: { type: DataTypes.INTEGER, field: "resolved_by" },
  resolvedAt: { type: DataTypes.DATE, field: "resolved_at" },
  rejectionReason: { type: DataTypes.TEXT, field: "rejection_reason" },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
}, { sequelize, tableName: "recovery_requests", timestamps: true, createdAt: "createdAt", updatedAt: "updatedAt" });

export default RecoveryRequest;