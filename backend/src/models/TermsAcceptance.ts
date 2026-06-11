import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class TermsAcceptance extends Model {
  declare id: number;
  declare userId: number;
  declare version: number;
  declare acceptedAt: Date;
  declare ipAddress: string | null;
}

TermsAcceptance.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    version: { type: DataTypes.INTEGER, allowNull: false },
    acceptedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "accepted_at" },
    ipAddress: { type: DataTypes.TEXT, allowNull: true, field: "ip_address" },
  },
  { sequelize, tableName: "terms_acceptances", timestamps: false }
);

export default TermsAcceptance;
