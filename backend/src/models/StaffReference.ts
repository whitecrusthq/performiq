import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class StaffReference extends Model {
  declare id: number;
  declare userId: number;
  declare refNumber: number;
  declare name: string | null;
  declare address: string | null;
  declare occupation: string | null;
  declare age: string | null;
  declare telephone: string | null;
  declare email: string | null;
  declare createdAt: Date;
}

StaffReference.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    refNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: "ref_number" },
    name: { type: DataTypes.TEXT },
    address: { type: DataTypes.TEXT },
    occupation: { type: DataTypes.TEXT },
    age: { type: DataTypes.TEXT },
    telephone: { type: DataTypes.TEXT },
    email: { type: DataTypes.TEXT },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "staff_references", timestamps: false }
);

export default StaffReference;
