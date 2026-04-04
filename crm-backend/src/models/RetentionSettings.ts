import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface RetentionSettingsAttributes {
  id: number;
  retentionDays: number;
  summarizeBeforeDelete: boolean;
  autoRunEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RetentionSettingsCreationAttributes
  extends Optional<RetentionSettingsAttributes, "id" | "summarizeBeforeDelete" | "autoRunEnabled"> {}

export class RetentionSettings extends Model<RetentionSettingsAttributes, RetentionSettingsCreationAttributes> implements RetentionSettingsAttributes {
  declare id: number;
  declare retentionDays: number;
  declare summarizeBeforeDelete: boolean;
  declare autoRunEnabled: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RetentionSettings.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    retentionDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 90, field: "retention_days" },
    summarizeBeforeDelete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "summarize_before_delete" },
    autoRunEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "auto_run_enabled" },
  },
  {
    sequelize,
    tableName: "crm_retention_settings",
    underscored: true,
  }
);
