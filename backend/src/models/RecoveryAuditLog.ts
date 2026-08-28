import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class RecoveryAuditLog extends Model {
  declare id: number;
  declare requestId: number | null;
  declare userId: number;
  declare actorId: number | null;
  declare event: string;
  declare detail: string | null;
  declare ipAddress: string | null;
  declare userAgent: string | null;
  declare createdAt: Date;
}

RecoveryAuditLog.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestId: { type: DataTypes.INTEGER, field: "request_id" },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
  actorId: { type: DataTypes.INTEGER, field: "actor_id" },
  event: { type: DataTypes.TEXT, allowNull: false },
  detail: { type: DataTypes.TEXT },
  ipAddress: { type: DataTypes.TEXT, field: "ip_address" },
  userAgent: { type: DataTypes.TEXT, field: "user_agent" },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
}, { sequelize, tableName: "recovery_audit_logs", timestamps: false });

export default RecoveryAuditLog;