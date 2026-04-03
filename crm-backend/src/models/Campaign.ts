import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface CampaignAttributes {
  id: number;
  name: string;
  channel: "whatsapp" | "facebook" | "instagram" | "sms" | "email" | "push" | "tiktok";
  status: "draft" | "scheduled" | "sent";
  message: string;
  recipients: number;
  sentAt: Date | null;
  scheduledAt: Date | null;
  openRate: number;
  clickRate: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CampaignCreationAttributes
  extends Optional<CampaignAttributes, "id" | "sentAt" | "scheduledAt" | "recipients" | "openRate" | "clickRate"> {}

export class Campaign extends Model<CampaignAttributes, CampaignCreationAttributes> implements CampaignAttributes {
  declare id: number;
  declare name: string;
  declare channel: "whatsapp" | "facebook" | "instagram" | "sms" | "email" | "push" | "tiktok";
  declare status: "draft" | "scheduled" | "sent";
  declare message: string;
  declare recipients: number;
  declare sentAt: Date | null;
  declare scheduledAt: Date | null;
  declare openRate: number;
  declare clickRate: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Campaign.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    channel: { type: DataTypes.STRING(50), allowNull: false },
    status: { type: DataTypes.ENUM("draft", "scheduled", "sent"), allowNull: false, defaultValue: "draft" },
    message: { type: DataTypes.TEXT, allowNull: false },
    recipients: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    sentAt: { type: DataTypes.DATE, allowNull: true, field: "sent_at" },
    scheduledAt: { type: DataTypes.DATE, allowNull: true, field: "scheduled_at" },
    openRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, field: "open_rate" },
    clickRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, field: "click_rate" },
  },
  {
    sequelize,
    tableName: "crm_campaigns",
    underscored: true,
  }
);
