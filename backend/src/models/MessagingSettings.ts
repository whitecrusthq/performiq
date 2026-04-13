import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface MessagingSettingsAttributes {
  id: number;
  provider: "twilio";
  accountSid: string | null;
  authToken: string | null;
  twilioPhoneNumber: string | null;
  twilioWhatsappNumber: string | null;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  updatedAt?: Date;
  createdAt?: Date;
}

export interface MessagingSettingsCreationAttributes
  extends Optional<MessagingSettingsAttributes, "id" | "accountSid" | "authToken" | "twilioPhoneNumber" | "twilioWhatsappNumber" | "smsEnabled" | "whatsappEnabled"> {}

export class MessagingSettings extends Model<MessagingSettingsAttributes, MessagingSettingsCreationAttributes>
  implements MessagingSettingsAttributes {
  declare id: number;
  declare provider: "twilio";
  declare accountSid: string | null;
  declare authToken: string | null;
  declare twilioPhoneNumber: string | null;
  declare twilioWhatsappNumber: string | null;
  declare smsEnabled: boolean;
  declare whatsappEnabled: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

MessagingSettings.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    provider: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "twilio" },
    accountSid: { type: DataTypes.TEXT, allowNull: true, field: "account_sid" },
    authToken: { type: DataTypes.TEXT, allowNull: true, field: "auth_token" },
    twilioPhoneNumber: { type: DataTypes.STRING(50), allowNull: true, field: "twilio_phone_number" },
    twilioWhatsappNumber: { type: DataTypes.STRING(50), allowNull: true, field: "twilio_whatsapp_number" },
    smsEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "sms_enabled" },
    whatsappEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "whatsapp_enabled" },
  },
  {
    sequelize,
    tableName: "crm_messaging_settings",
    underscored: true,
  }
);
