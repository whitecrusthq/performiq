import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export type AgentRole = "super_admin" | "admin" | "agent" | "supervisor";

export interface AgentAttributes {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: AgentRole;
  avatar: string | null;
  isActive: boolean;
  allowedMenus: string[] | null;
  siteIds: number[] | null;
  activeConversations: number;
  resolvedToday: number;
  rating: number;
  lastActiveAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AgentCreationAttributes
  extends Optional<AgentAttributes, "id" | "avatar" | "isActive" | "allowedMenus" | "siteIds" | "activeConversations" | "resolvedToday" | "rating" | "lastActiveAt"> {}

export class Agent extends Model<AgentAttributes, AgentCreationAttributes> implements AgentAttributes {
  declare id: number;
  declare name: string;
  declare email: string;
  declare passwordHash: string;
  declare role: AgentRole;
  declare avatar: string | null;
  declare isActive: boolean;
  declare allowedMenus: string[] | null;
  declare siteIds: number[] | null;
  declare activeConversations: number;
  declare resolvedToday: number;
  declare rating: number;
  declare lastActiveAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Agent.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: "password_hash" },
    role: { type: DataTypes.ENUM("super_admin", "admin", "agent", "supervisor"), allowNull: false, defaultValue: "agent" },
    avatar: { type: DataTypes.STRING(500), allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
    allowedMenus: { type: DataTypes.JSON, allowNull: true, defaultValue: null, field: "allowed_menus" },
    siteIds: { type: DataTypes.JSON, allowNull: true, defaultValue: null, field: "site_ids" },
    activeConversations: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "active_conversations" },
    resolvedToday: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "resolved_today" },
    rating: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 5.0 },
    lastActiveAt: { type: DataTypes.DATE, allowNull: true, field: "last_active_at" },
  },
  {
    sequelize,
    tableName: "crm_agents",
    underscored: true,
  }
);
