import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class WorkflowTemplate extends Model {
  declare id: number;
  declare name: string;
  declare type: string;
  declare description: string | null;
  declare isDefault: boolean;
  declare createdById: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

WorkflowTemplate.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_default" },
    createdById: { type: DataTypes.INTEGER, allowNull: false, field: "created_by_id" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "workflow_templates", timestamps: false }
);

export default WorkflowTemplate;
