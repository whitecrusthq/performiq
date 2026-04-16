import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class Criterion extends Model {
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare category: string;
  declare weight: string;
  declare type: string;
  declare targetValue: string | null;
  declare unit: string | null;
  declare targetPeriod: string | null;
  declare createdAt: Date;
}

Criterion.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    category: { type: DataTypes.TEXT, allowNull: false },
    weight: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: "1" },
    type: { type: DataTypes.TEXT, allowNull: false, defaultValue: "rating" },
    targetValue: { type: DataTypes.DECIMAL(15, 2), field: "target_value" },
    unit: { type: DataTypes.TEXT },
    targetPeriod: { type: DataTypes.TEXT, field: "target_period" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "criteria", timestamps: false }
);

export default Criterion;
