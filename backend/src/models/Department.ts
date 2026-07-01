import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class Department extends Model {
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare shiftType: string | null;
  declare clockOutSlot: string | null;
  declare createdAt: Date;
}

Department.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false, unique: true },
    description: { type: DataTypes.TEXT },
    shiftType: { type: DataTypes.TEXT, field: "shift_type" },
    clockOutSlot: { type: DataTypes.TEXT, field: "clock_out_slot" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "departments", timestamps: false }
);

export default Department;
