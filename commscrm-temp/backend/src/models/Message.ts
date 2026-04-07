import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface MessageAttributes {
  id: number;
  conversationId: number;
  sender: "customer" | "agent" | "bot";
  content: string;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MessageCreationAttributes
  extends Optional<MessageAttributes, "id" | "isRead"> {}

export class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  declare id: number;
  declare conversationId: number;
  declare sender: "customer" | "agent" | "bot";
  declare content: string;
  declare isRead: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Message.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    conversationId: { type: DataTypes.INTEGER, allowNull: false, field: "conversation_id", references: { model: "crm_conversations", key: "id" } },
    sender: { type: DataTypes.ENUM("customer", "agent", "bot"), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_read" },
  },
  {
    sequelize,
    tableName: "crm_messages",
    underscored: true,
  }
);
