import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface ClosedConversationAttributes {
  id: number;
  originalId: number;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  assignedAgentId: number | null;
  assignedAgentName: string | null;
  closedByAgentId: number | null;
  closedByAgentName: string | null;
  channel: "whatsapp" | "facebook" | "instagram";
  messageCount: number;
  closedAt: Date;
  originalCreatedAt: Date;
  summary: string | null;
  messagesDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClosedConversationCreationAttributes
  extends Optional<ClosedConversationAttributes, "id" | "assignedAgentId" | "assignedAgentName" | "closedByAgentId" | "closedByAgentName" | "customerPhone" | "summary" | "messagesDeleted"> {}

export class ClosedConversation extends Model<ClosedConversationAttributes, ClosedConversationCreationAttributes> implements ClosedConversationAttributes {
  declare id: number;
  declare originalId: number;
  declare customerId: number;
  declare customerName: string;
  declare customerPhone: string | null;
  declare assignedAgentId: number | null;
  declare assignedAgentName: string | null;
  declare closedByAgentId: number | null;
  declare closedByAgentName: string | null;
  declare channel: "whatsapp" | "facebook" | "instagram";
  declare messageCount: number;
  declare closedAt: Date;
  declare originalCreatedAt: Date;
  declare summary: string | null;
  declare messagesDeleted: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ClosedConversation.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    originalId: { type: DataTypes.INTEGER, allowNull: false, field: "original_id" },
    customerId: { type: DataTypes.INTEGER, allowNull: false, field: "customer_id" },
    customerName: { type: DataTypes.STRING(100), allowNull: false, field: "customer_name" },
    customerPhone: { type: DataTypes.STRING(50), allowNull: true, field: "customer_phone" },
    assignedAgentId: { type: DataTypes.INTEGER, allowNull: true, field: "assigned_agent_id" },
    assignedAgentName: { type: DataTypes.STRING(100), allowNull: true, field: "assigned_agent_name" },
    closedByAgentId: { type: DataTypes.INTEGER, allowNull: true, field: "closed_by_agent_id" },
    closedByAgentName: { type: DataTypes.STRING(100), allowNull: true, field: "closed_by_agent_name" },
    channel: { type: DataTypes.ENUM("whatsapp", "facebook", "instagram"), allowNull: false },
    messageCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "message_count" },
    closedAt: { type: DataTypes.DATE, allowNull: false, field: "closed_at" },
    originalCreatedAt: { type: DataTypes.DATE, allowNull: false, field: "original_created_at" },
    summary: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    messagesDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "messages_deleted" },
  },
  {
    sequelize,
    tableName: "crm_closed_conversations",
    underscored: true,
  }
);
