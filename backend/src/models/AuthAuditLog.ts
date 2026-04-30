import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

export type AuthAuditEvent = "login_success" | "login_failed" | "logout";

class AuthAuditLog extends Model {
  declare id: number;
  declare userId: number | null;
  declare email: string;
  declare event: AuthAuditEvent;
  declare failureReason: string | null;
  declare ipAddress: string | null;
  declare userAgent: string | null;
  declare country: string | null;
  declare region: string | null;
  declare city: string | null;
  declare latitude: number | null;
  declare longitude: number | null;
  declare createdAt: Date;
}

AuthAuditLog.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, field: "user_id" },
    email: { type: DataTypes.TEXT, allowNull: false },
    event: { type: DataTypes.TEXT, allowNull: false },
    failureReason: { type: DataTypes.TEXT, field: "failure_reason" },
    ipAddress: { type: DataTypes.TEXT, field: "ip_address" },
    userAgent: { type: DataTypes.TEXT, field: "user_agent" },
    country: { type: DataTypes.TEXT },
    region: { type: DataTypes.TEXT },
    city: { type: DataTypes.TEXT },
    latitude: { type: DataTypes.DOUBLE },
    longitude: { type: DataTypes.DOUBLE },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "auth_audit_logs", timestamps: false }
);

export default AuthAuditLog;
