import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class Cycle extends Model {
  declare id: number;
  declare name: string;
  declare startDate: string;
  declare endDate: string;
  declare status: string;
  declare scoringMode: string;
  declare selfWeight: number;
  declare upwardIncluded: boolean;
  declare createdAt: Date;
}

Cycle.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    startDate: { type: DataTypes.DATEONLY, allowNull: false, field: "start_date" },
    endDate: { type: DataTypes.DATEONLY, allowNull: false, field: "end_date" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "draft" },
    scoringMode: { type: DataTypes.TEXT, allowNull: false, defaultValue: "managers_only", field: "scoring_mode" },
    selfWeight: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30, field: "self_weight" },
    upwardIncluded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "upward_included" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "cycles", timestamps: false }
);

export default Cycle;
