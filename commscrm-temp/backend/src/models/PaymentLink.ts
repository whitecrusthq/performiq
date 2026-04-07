import { Model, DataTypes, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";
import type { TxProvider, TxCurrency } from "./PaymentTransaction.js";

export type LinkStatus = "active" | "expired" | "paid" | "cancelled";

export interface PaymentLinkAttributes {
  id: number;
  provider: TxProvider;
  title: string;
  description: string | null;
  amount: number;
  currency: TxCurrency;
  status: LinkStatus;
  linkToken: string;
  linkUrl: string | null;
  expiresAt: Date | null;
  paidAt: Date | null;
  customerName: string | null;
  customerEmail: string | null;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaymentLinkCreationAttributes
  extends Optional<PaymentLinkAttributes, "id" | "description" | "linkUrl" | "expiresAt" | "paidAt" | "customerName" | "customerEmail"> {}

export class PaymentLink
  extends Model<PaymentLinkAttributes, PaymentLinkCreationAttributes>
  implements PaymentLinkAttributes
{
  declare id: number;
  declare provider: TxProvider;
  declare title: string;
  declare description: string | null;
  declare amount: number;
  declare currency: TxCurrency;
  declare status: LinkStatus;
  declare linkToken: string;
  declare linkUrl: string | null;
  declare expiresAt: Date | null;
  declare paidAt: Date | null;
  declare customerName: string | null;
  declare customerEmail: string | null;
  declare createdBy: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

PaymentLink.init(
  {
    id:            { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    provider:      { type: DataTypes.STRING, allowNull: false },
    title:         { type: DataTypes.STRING, allowNull: false },
    description:   { type: DataTypes.TEXT, allowNull: true },
    amount:        { type: DataTypes.FLOAT, allowNull: false },
    currency:      { type: DataTypes.STRING(5), allowNull: false, defaultValue: "USD" },
    status:        { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
    linkToken:     { type: DataTypes.STRING, allowNull: false, unique: true },
    linkUrl:       { type: DataTypes.STRING, allowNull: true },
    expiresAt:     { type: DataTypes.DATE, allowNull: true },
    paidAt:        { type: DataTypes.DATE, allowNull: true },
    customerName:  { type: DataTypes.STRING, allowNull: true },
    customerEmail: { type: DataTypes.STRING, allowNull: true },
    createdBy:     { type: DataTypes.STRING, allowNull: false },
  },
  { sequelize, modelName: "PaymentLink", tableName: "crm_payment_links" }
);
