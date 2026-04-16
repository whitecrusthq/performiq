import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class LeaveType extends Model {
  declare id: number;
  declare name: string;
  declare label: string;
  declare isDefault: boolean;
  declare createdAt: Date;
}

LeaveType.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(200), allowNull: false },
    isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_default" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "leave_types", timestamps: false }
);

export default LeaveType;
