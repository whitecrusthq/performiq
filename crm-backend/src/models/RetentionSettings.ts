import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export type RetentionAction = "archive" | "delete";

export interface RetentionSettingsAttributes {
  id: number;
  retentionDays: number;
  summarizeBeforeDelete: boolean;
  autoRunEnabled: boolean;
  action: RetentionAction;
  channelFilter: string;
  includeClosedMessages: boolean;
  includeFeedback: boolean;
  minMessageCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RetentionSettingsCreationAttributes
  extends Optional<RetentionSettingsAttributes, "id" | "summarizeBeforeDelete" | "autoRunEnabled" | "action" | "channelFilter" | "includeClosedMessages" | "includeFeedback" | "minMessageCount"> {}

export class RetentionSettings extends Model<RetentionSettingsAttributes, RetentionSettingsCreationAttributes> implements RetentionSettingsAttributes {
  declare id: number;
  declare retentionDays: number;
  declare summarizeBeforeDelete: boolean;
  declare autoRunEnabled: boolean;
  declare action: RetentionAction;
  declare channelFilter: string;
  declare includeClosedMessages: boolean;
  declare includeFeedback: boolean;
  declare minMessageCount: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RetentionSettings.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    retentionDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 90, field: "retention_days" },
    summarizeBeforeDelete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "summarize_before_delete" },
    autoRunEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "auto_run_enabled" },
    action: {
      type: DataTypes.ENUM("archive", "delete"),
      allowNull: false,
      defaultValue: "archive",
    },
    channelFilter: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '["all"]',
      field: "channel_filter",
    },
    includeClosedMessages: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "include_closed_messages",
    },
    includeFeedback: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "include_feedback",
    },
    minMessageCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "min_message_count",
    },
  },
  {
    sequelize,
    tableName: "crm_retention_settings",
    underscored: true,
  }
);
