import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class OnboardingWorkflow extends Model {
  declare id: number;
  declare type: string;
  declare status: string;
  declare employeeId: number;
  declare templateId: number | null;
  declare title: string;
  declare notes: string | null;
  declare startedById: number;
  declare startDate: Date;
  declare targetCompletionDate: Date | null;
  declare completedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

OnboardingWorkflow.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    type: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "active" },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: "employee_id" },
    templateId: { type: DataTypes.INTEGER, field: "template_id" },
    title: { type: DataTypes.TEXT, allowNull: false },
    notes: { type: DataTypes.TEXT },
    startedById: { type: DataTypes.INTEGER, allowNull: false, field: "started_by_id" },
    startDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "start_date" },
    targetCompletionDate: { type: DataTypes.DATE, field: "target_completion_date" },
    completedAt: { type: DataTypes.DATE, field: "completed_at" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "onboarding_workflows", timestamps: false }
);

export default OnboardingWorkflow;
