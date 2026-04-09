import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export type SourceType = "api" | "webhook" | "manual";

export interface ProductSourceAttributes {
  id: number;
  name: string;
  type: SourceType;
  apiUrl: string | null;
  apiKey: string | null;
  webhookSecret: string | null;
  headerKey: string | null;
  headerValue: string | null;
  fieldMapping: Record<string, string> | null;
  syncInterval: number | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncCount: number | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductSourceCreationAttributes
  extends Optional<ProductSourceAttributes, "id" | "apiUrl" | "apiKey" | "webhookSecret" | "headerKey" | "headerValue" | "fieldMapping" | "syncInterval" | "lastSyncAt" | "lastSyncStatus" | "lastSyncCount" | "isActive"> {}

export class ProductSource extends Model<ProductSourceAttributes, ProductSourceCreationAttributes> implements ProductSourceAttributes {
  declare id: number;
  declare name: string;
  declare type: SourceType;
  declare apiUrl: string | null;
  declare apiKey: string | null;
  declare webhookSecret: string | null;
  declare headerKey: string | null;
  declare headerValue: string | null;
  declare fieldMapping: Record<string, string> | null;
  declare syncInterval: number | null;
  declare lastSyncAt: Date | null;
  declare lastSyncStatus: string | null;
  declare lastSyncCount: number | null;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ProductSource.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "api" },
    apiUrl: { type: DataTypes.TEXT, allowNull: true, field: "api_url" },
    apiKey: { type: DataTypes.TEXT, allowNull: true, field: "api_key" },
    webhookSecret: { type: DataTypes.STRING(255), allowNull: true, field: "webhook_secret" },
    headerKey: { type: DataTypes.STRING(100), allowNull: true, field: "header_key" },
    headerValue: { type: DataTypes.TEXT, allowNull: true, field: "header_value" },
    fieldMapping: { type: DataTypes.JSONB, allowNull: true, field: "field_mapping" },
    syncInterval: { type: DataTypes.INTEGER, allowNull: true, field: "sync_interval" },
    lastSyncAt: { type: DataTypes.DATE, allowNull: true, field: "last_sync_at" },
    lastSyncStatus: { type: DataTypes.STRING(50), allowNull: true, field: "last_sync_status" },
    lastSyncCount: { type: DataTypes.INTEGER, allowNull: true, field: "last_sync_count" },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
  },
  {
    sequelize,
    tableName: "crm_product_sources",
    underscored: true,
  }
);
