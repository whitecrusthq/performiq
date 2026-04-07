import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface FeedbackAttributes {
  id: number;
  conversationId: number | null;
  customerId: number | null;
  rating: number;
  comment: string | null;
  channel: string;
  agentId: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FeedbackCreationAttributes
  extends Optional<FeedbackAttributes, "id" | "conversationId" | "customerId" | "comment" | "agentId"> {}

export class Feedback extends Model<FeedbackAttributes, FeedbackCreationAttributes> implements FeedbackAttributes {
  declare id: number;
  declare conversationId: number | null;
  declare customerId: number | null;
  declare rating: number;
  declare comment: string | null;
  declare channel: string;
  declare agentId: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Feedback.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    conversationId: { type: DataTypes.INTEGER, allowNull: true, field: "conversation_id" },
    customerId: { type: DataTypes.INTEGER, allowNull: true, field: "customer_id" },
    rating: { type: DataTypes.INTEGER, allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: true },
    channel: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "whatsapp" },
    agentId: { type: DataTypes.INTEGER, allowNull: true, field: "agent_id" },
  },
  {
    sequelize,
    tableName: "crm_feedback",
    underscored: true,
  }
);
