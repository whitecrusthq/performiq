import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export type FollowUpType = "whatsapp" | "sms" | "email" | "facebook" | "instagram" | "phone";

export interface ConversationAttributes {
  id: number;
  customerId: number;
  assignedAgentId: number | null;
  channel: "whatsapp" | "facebook" | "instagram";
  status: "open" | "ongoing" | "pending" | "resolved";
  unreadCount: number;
  lastMessageAt: Date | null;
  lockedByAgentId: number | null;
  lockedAt: Date | null;
  followUpAt: Date | null;
  followUpNote: string | null;
  followUpType: FollowUpType | null;
  reopenCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConversationCreationAttributes
  extends Optional<ConversationAttributes, "id" | "assignedAgentId" | "unreadCount" | "lastMessageAt" | "lockedByAgentId" | "lockedAt" | "followUpAt" | "followUpNote" | "followUpType" | "reopenCount"> {}

export class Conversation extends Model<ConversationAttributes, ConversationCreationAttributes> implements ConversationAttributes {
  declare id: number;
  declare customerId: number;
  declare assignedAgentId: number | null;
  declare channel: "whatsapp" | "facebook" | "instagram";
  declare status: "open" | "ongoing" | "pending" | "resolved";
  declare unreadCount: number;
  declare lastMessageAt: Date | null;
  declare lockedByAgentId: number | null;
  declare lockedAt: Date | null;
  declare followUpAt: Date | null;
  declare followUpNote: string | null;
  declare followUpType: FollowUpType | null;
  declare reopenCount: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Conversation.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    customerId: { type: DataTypes.INTEGER, allowNull: false, field: "customer_id", references: { model: "crm_customers", key: "id" } },
    assignedAgentId: { type: DataTypes.INTEGER, allowNull: true, field: "assigned_agent_id", references: { model: "crm_agents", key: "id" } },
    channel: { type: DataTypes.ENUM("whatsapp", "facebook", "instagram"), allowNull: false },
    status: { type: DataTypes.ENUM("open", "ongoing", "pending", "resolved"), allowNull: false, defaultValue: "open" },
    unreadCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "unread_count" },
    lastMessageAt: { type: DataTypes.DATE, allowNull: true, field: "last_message_at" },
    lockedByAgentId: { type: DataTypes.INTEGER, allowNull: true, field: "locked_by_agent_id" },
    lockedAt: { type: DataTypes.DATE, allowNull: true, field: "locked_at" },
    followUpAt: { type: DataTypes.DATE, allowNull: true, field: "follow_up_at" },
    followUpNote: { type: DataTypes.TEXT, allowNull: true, field: "follow_up_note" },
    followUpType: { type: DataTypes.STRING(20), allowNull: true, field: "follow_up_type" },
    reopenCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "reopen_count" },
  },
  {
    sequelize,
    tableName: "crm_conversations",
    underscored: true,
  }
);
