import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export type PaymentProvider = "stripe" | "paystack" | "flutterwave" | "paypal" | "square";

export interface PaymentConfigAttributes {
  id: number;
  provider: PaymentProvider;
  isEnabled: boolean;
  isLiveMode: boolean;
  publicKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
  webhookToken: string;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaymentConfigCreationAttributes
  extends Optional<PaymentConfigAttributes, "id" | "isEnabled" | "isLiveMode" | "publicKey" | "secretKey" | "webhookSecret" | "metadata"> {}

export class PaymentConfig
  extends Model<PaymentConfigAttributes, PaymentConfigCreationAttributes>
  implements PaymentConfigAttributes
{
  declare id: number;
  declare provider: PaymentProvider;
  declare isEnabled: boolean;
  declare isLiveMode: boolean;
  declare publicKey: string | null;
  declare secretKey: string | null;
  declare webhookSecret: string | null;
  declare webhookToken: string;
  declare metadata: Record<string, unknown> | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

PaymentConfig.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    provider: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_enabled" },
    isLiveMode: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_live_mode" },
    publicKey: { type: DataTypes.TEXT, allowNull: true, field: "public_key" },
    secretKey: { type: DataTypes.TEXT, allowNull: true, field: "secret_key" },
    webhookSecret: { type: DataTypes.TEXT, allowNull: true, field: "webhook_secret" },
    webhookToken: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: "webhook_token",
      defaultValue: () => [...Array(48)].map(() => Math.random().toString(36)[2]).join(""),
    },
    metadata: { type: DataTypes.JSONB, allowNull: true },
  },
  {
    sequelize,
    tableName: "crm_payment_configs",
    underscored: true,
  }
);
