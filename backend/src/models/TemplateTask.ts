import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class TemplateTask extends Model {
  declare id: number;
  declare templateId: number;
  declare title: string;
  declare description: string | null;
  declare category: string | null;
  declare orderIndex: number;
  declare defaultAssigneeRole: string | null;
  declare dueInDays: number | null;
  declare createdAt: Date;
}

TemplateTask.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    templateId: { type: DataTypes.INTEGER, allowNull: false, field: "template_id" },
    title: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    category: { type: DataTypes.TEXT },
    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "order_index" },
    defaultAssigneeRole: { type: DataTypes.TEXT, field: "default_assignee_role" },
    dueInDays: { type: DataTypes.INTEGER, field: "due_in_days" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "template_tasks", timestamps: false }
);

export default TemplateTask;
