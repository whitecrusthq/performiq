import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export type FollowUpCategory = "sales" | "reminder" | "product_update" | "discount" | "reengagement" | "custom";
export type FollowUpTrigger = "resolved" | "inactive" | "manual";
export type FollowUpPriority = "low" | "medium" | "high";

export interface FollowUpRuleAttributes {
  id: number;
  name: string;
  category: FollowUpCategory;
  isEnabled: boolean;
  delayDays: number;
  trigger: FollowUpTrigger;
  inactivityDays: number | null;
  messageTemplate: string;
  useAiPersonalization: boolean;
  assignToLastAgent: boolean;
  priority: FollowUpPriority;
  sendBetweenHoursStart: number;
  sendBetweenHoursEnd: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FollowUpRuleCreationAttributes
  extends Optional<FollowUpRuleAttributes, "id" | "inactivityDays" | "useAiPersonalization" | "assignToLastAgent" | "sendBetweenHoursStart" | "sendBetweenHoursEnd"> {}

export class FollowUpRule extends Model<FollowUpRuleAttributes, FollowUpRuleCreationAttributes> implements FollowUpRuleAttributes {
  declare id: number;
  declare name: string;
  declare category: FollowUpCategory;
  declare isEnabled: boolean;
  declare delayDays: number;
  declare trigger: FollowUpTrigger;
  declare inactivityDays: number | null;
  declare messageTemplate: string;
  declare useAiPersonalization: boolean;
  declare assignToLastAgent: boolean;
  declare priority: FollowUpPriority;
  declare sendBetweenHoursStart: number;
  declare sendBetweenHoursEnd: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

FollowUpRule.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    category: {
      type: DataTypes.ENUM("sales", "reminder", "product_update", "discount", "reengagement", "custom"),
      allowNull: false,
      defaultValue: "reminder",
    },
    isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_enabled" },
    delayDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3, field: "delay_days" },
    trigger: {
      type: DataTypes.ENUM("resolved", "inactive", "manual"),
      allowNull: false,
      defaultValue: "resolved",
    },
    inactivityDays: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null, field: "inactivity_days" },
    messageTemplate: { type: DataTypes.TEXT, allowNull: false, field: "message_template" },
    useAiPersonalization: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "use_ai_personalization" },
    assignToLastAgent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "assign_to_last_agent" },
    priority: {
      type: DataTypes.ENUM("low", "medium", "high"),
      allowNull: false,
      defaultValue: "medium",
    },
    sendBetweenHoursStart: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 9, field: "send_between_hours_start" },
    sendBetweenHoursEnd: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 18, field: "send_between_hours_end" },
  },
  {
    sequelize,
    tableName: "crm_follow_up_rules",
    underscored: true,
  }
);
