import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export type AiProvider = "gemini" | "openai" | "anthropic" | "custom";

export interface AiSettingsAttributes {
  id: number;
  provider: AiProvider;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
  temperature: number;
  maxTokens: number;
  updatedAt?: Date;
  createdAt?: Date;
}

export interface AiSettingsCreationAttributes
  extends Optional<AiSettingsAttributes, "id" | "apiKey" | "baseUrl"> {}

export class AiSettings extends Model<AiSettingsAttributes, AiSettingsCreationAttributes> implements AiSettingsAttributes {
  declare id: number;
  declare provider: AiProvider;
  declare model: string;
  declare apiKey: string | null;
  declare baseUrl: string | null;
  declare temperature: number;
  declare maxTokens: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AiSettings.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    provider: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "gemini" },
    model: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "gemini-2.5-flash" },
    apiKey: { type: DataTypes.TEXT, allowNull: true, field: "api_key" },
    baseUrl: { type: DataTypes.TEXT, allowNull: true, field: "base_url" },
    temperature: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.7 },
    maxTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 8192, field: "max_tokens" },
  },
  {
    sequelize,
    tableName: "crm_ai_settings",
    underscored: true,
  }
);
