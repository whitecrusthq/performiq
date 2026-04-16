import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class Cycle extends Model {
  declare id: number;
  declare name: string;
  declare startDate: string;
  declare endDate: string;
  declare status: string;
  declare createdAt: Date;
}

Cycle.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    startDate: { type: DataTypes.DATEONLY, allowNull: false, field: "start_date" },
    endDate: { type: DataTypes.DATEONLY, allowNull: false, field: "end_date" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "draft" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "cycles", timestamps: false }
);

export default Cycle;
