import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class WorkflowTask extends Model {
  declare id: number;
  declare workflowId: number;
  declare title: string;
  declare description: string | null;
  declare category: string | null;
  declare orderIndex: number;
  declare status: string;
  declare assigneeId: number | null;
  declare dueDate: Date | null;
  declare completedAt: Date | null;
  declare completedById: number | null;
  declare notes: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

WorkflowTask.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workflowId: { type: DataTypes.INTEGER, allowNull: false, field: "workflow_id" },
    title: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    category: { type: DataTypes.TEXT },
    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "order_index" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending" },
    assigneeId: { type: DataTypes.INTEGER, field: "assignee_id" },
    dueDate: { type: DataTypes.DATE, field: "due_date" },
    completedAt: { type: DataTypes.DATE, field: "completed_at" },
    completedById: { type: DataTypes.INTEGER, field: "completed_by_id" },
    notes: { type: DataTypes.TEXT },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "workflow_tasks", timestamps: false }
);

export default WorkflowTask;
