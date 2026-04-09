import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface ClosedMessageAttributes {
  id: number;
  closedConversationId: number;
  sender: "customer" | "agent" | "bot";
  content: string;
  isRead: boolean;
  originalCreatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClosedMessageCreationAttributes
  extends Optional<ClosedMessageAttributes, "id" | "isRead"> {}

export class ClosedMessage extends Model<ClosedMessageAttributes, ClosedMessageCreationAttributes> implements ClosedMessageAttributes {
  declare id: number;
  declare closedConversationId: number;
  declare sender: "customer" | "agent" | "bot";
  declare content: string;
  declare isRead: boolean;
  declare originalCreatedAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ClosedMessage.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    closedConversationId: { type: DataTypes.INTEGER, allowNull: false, field: "closed_conversation_id", references: { model: "crm_closed_conversations", key: "id" } },
    sender: { type: DataTypes.ENUM("customer", "agent", "bot"), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_read" },
    originalCreatedAt: { type: DataTypes.DATE, allowNull: false, field: "original_created_at" },
  },
  {
    sequelize,
    tableName: "crm_closed_messages",
    underscored: true,
  }
);
