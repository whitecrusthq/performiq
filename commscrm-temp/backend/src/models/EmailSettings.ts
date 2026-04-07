import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface EmailSettingsAttributes {
  id: number;
  provider: string;
  apiKey: string | null;
  domain: string | null;
  region: "us" | "eu";
  fromEmail: string | null;
  fromName: string | null;
  isActive: boolean;
  updatedAt?: Date;
  createdAt?: Date;
}

export interface EmailSettingsCreationAttributes
  extends Optional<EmailSettingsAttributes, "id" | "apiKey" | "domain" | "fromEmail" | "fromName" | "isActive"> {}

export class EmailSettings extends Model<EmailSettingsAttributes, EmailSettingsCreationAttributes>
  implements EmailSettingsAttributes {
  declare id: number;
  declare provider: string;
  declare apiKey: string | null;
  declare domain: string | null;
  declare region: "us" | "eu";
  declare fromEmail: string | null;
  declare fromName: string | null;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

EmailSettings.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    provider: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "mailgun" },
    apiKey: { type: DataTypes.TEXT, allowNull: true, field: "api_key" },
    domain: { type: DataTypes.STRING(255), allowNull: true },
    region: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "us" },
    fromEmail: { type: DataTypes.STRING(255), allowNull: true, field: "from_email" },
    fromName: { type: DataTypes.STRING(255), allowNull: true, field: "from_name" },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_active" },
  },
  {
    sequelize,
    tableName: "crm_email_settings",
    underscored: true,
  }
);
