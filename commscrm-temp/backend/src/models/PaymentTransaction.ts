import { Model, DataTypes, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export type TxStatus = "success" | "failed" | "pending" | "refunded";
export type TxProvider = "stripe" | "paystack" | "flutterwave" | "paypal" | "square";
export type TxCurrency = "USD" | "NGN" | "GHS" | "KES" | "ZAR" | "GBP" | "EUR";

export interface PaymentTransactionAttributes {
  id: number;
  provider: TxProvider;
  txRef: string;
  amount: number;
  currency: TxCurrency;
  status: TxStatus;
  customerName: string;
  customerEmail: string;
  description: string | null;
  metadata: object | null;
  paidAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaymentTransactionCreationAttributes
  extends Optional<PaymentTransactionAttributes, "id" | "description" | "metadata" | "paidAt"> {}

export class PaymentTransaction
  extends Model<PaymentTransactionAttributes, PaymentTransactionCreationAttributes>
  implements PaymentTransactionAttributes
{
  declare id: number;
  declare provider: TxProvider;
  declare txRef: string;
  declare amount: number;
  declare currency: TxCurrency;
  declare status: TxStatus;
  declare customerName: string;
  declare customerEmail: string;
  declare description: string | null;
  declare metadata: object | null;
  declare paidAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

PaymentTransaction.init(
  {
    id:            { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    provider:      { type: DataTypes.STRING, allowNull: false },
    txRef:         { type: DataTypes.STRING, allowNull: false, unique: true },
    amount:        { type: DataTypes.FLOAT, allowNull: false },
    currency:      { type: DataTypes.STRING(5), allowNull: false, defaultValue: "USD" },
    status:        { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" },
    customerName:  { type: DataTypes.STRING, allowNull: false },
    customerEmail: { type: DataTypes.STRING, allowNull: false },
    description:   { type: DataTypes.TEXT, allowNull: true },
    metadata:      { type: DataTypes.JSONB, allowNull: true },
    paidAt:        { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: "PaymentTransaction", tableName: "crm_payment_transactions" }
);
