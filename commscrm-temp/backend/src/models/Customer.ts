import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface CustomerAttributes {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  channel: "whatsapp" | "facebook" | "instagram" | "widget";
  tags: string[];
  notes: string | null;
  totalConversations: number;
  lastSeen: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustomerCreationAttributes
  extends Optional<CustomerAttributes, "id" | "email" | "phone" | "notes" | "lastSeen" | "totalConversations" | "tags"> {}

export class Customer extends Model<CustomerAttributes, CustomerCreationAttributes> implements CustomerAttributes {
  declare id: number;
  declare name: string;
  declare email: string | null;
  declare phone: string | null;
  declare channel: "whatsapp" | "facebook" | "instagram" | "widget";
  declare tags: string[];
  declare notes: string | null;
  declare totalConversations: number;
  declare lastSeen: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Customer.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: true },
    phone: { type: DataTypes.STRING(50), allowNull: true },
    channel: { type: DataTypes.ENUM("whatsapp", "facebook", "instagram", "widget"), allowNull: false },
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
    notes: { type: DataTypes.TEXT, allowNull: true },
    totalConversations: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "total_conversations" },
    lastSeen: { type: DataTypes.DATE, allowNull: true, field: "last_seen" },
  },
  {
    sequelize,
    tableName: "crm_customers",
    underscored: true,
  }
);
