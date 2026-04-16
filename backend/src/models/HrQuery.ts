import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class HrQuery extends Model {
  declare id: number;
  declare userId: number;
  declare title: string;
  declare description: string;
  declare category: string;
  declare priority: string;
  declare status: string;
  declare assignedTo: number | null;
  declare response: string | null;
  declare respondedBy: number | null;
  declare respondedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

HrQuery.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    title: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.TEXT, allowNull: false, defaultValue: "general" },
    priority: { type: DataTypes.TEXT, allowNull: false, defaultValue: "normal" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "open" },
    assignedTo: { type: DataTypes.INTEGER, field: "assigned_to" },
    response: { type: DataTypes.TEXT },
    respondedBy: { type: DataTypes.INTEGER, field: "responded_by" },
    respondedAt: { type: DataTypes.DATE, field: "responded_at" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "hr_queries", timestamps: false }
);

export default HrQuery;
