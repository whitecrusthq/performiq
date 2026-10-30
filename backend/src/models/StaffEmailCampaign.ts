import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class StaffEmailCampaign extends Model {
  declare id: number;
  declare subject: string;
  declare body: string;
  declare filters: Record<string, unknown>;
  declare recipientCount: number;
  declare sentCount: number;
  declare failedCount: number;
  declare failures: { email: string; error: string }[];
  declare status: string;
  declare sentById: number | null;
  declare createdAt: Date;
  declare completedAt: Date | null;
}

StaffEmailCampaign.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    subject: { type: DataTypes.TEXT, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    filters: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    recipientCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "recipient_count" },
    sentCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "sent_count" },
    failedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "failed_count" },
    failures: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "sending" },
    sentById: { type: DataTypes.INTEGER, field: "sent_by_id" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    completedAt: { type: DataTypes.DATE, field: "completed_at" },
  },
  { sequelize, tableName: "staff_email_campaigns", timestamps: false }
);

export default StaffEmailCampaign;
