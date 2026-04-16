import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class StaffBeneficiary extends Model {
  declare id: number;
  declare userId: number;
  declare name: string;
  declare address: string | null;
  declare phoneNumber: string | null;
  declare orderIndex: number;
  declare createdAt: Date;
}

StaffBeneficiary.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    name: { type: DataTypes.TEXT, allowNull: false },
    address: { type: DataTypes.TEXT },
    phoneNumber: { type: DataTypes.TEXT, field: "phone_number" },
    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "order_index" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "staff_beneficiaries", timestamps: false }
);

export default StaffBeneficiary;
