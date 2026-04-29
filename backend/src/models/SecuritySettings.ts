import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class SecuritySettings extends Model {
  declare id: number;
  declare lockoutEnabled: boolean;
  declare maxAttempts: number;
  declare lockoutDurationMinutes: number;
  declare enforce2faAll: boolean;
  declare enforce2faRoles: string | null;
  declare updatedAt: Date;
}

SecuritySettings.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    lockoutEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "lockout_enabled" },
    maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5, field: "max_attempts" },
    lockoutDurationMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30, field: "lockout_duration_minutes" },
    enforce2faAll: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "enforce_2fa_all" },
    enforce2faRoles: { type: DataTypes.TEXT, field: "enforce_2fa_roles" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "security_settings", timestamps: false }
);

export default SecuritySettings;
