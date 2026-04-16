import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class CriteriaGroup extends Model {
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare createdAt: Date;
}

CriteriaGroup.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "criteria_groups", timestamps: false }
);

export default CriteriaGroup;
