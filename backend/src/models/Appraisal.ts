import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class Appraisal extends Model {
  declare id: number;
  declare cycleId: number;
  declare employeeId: number;
  declare reviewerId: number | null;
  declare status: string;
  declare workflowType: string;
  declare selfComment: string | null;
  declare managerComment: string | null;
  declare overallScore: string | null;
  declare criteriaGroupId: number | null;
  declare createdAt: Date;
}

Appraisal.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cycleId: { type: DataTypes.INTEGER, allowNull: false, field: "cycle_id" },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: "employee_id" },
    reviewerId: { type: DataTypes.INTEGER, field: "reviewer_id" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending" },
    workflowType: { type: DataTypes.TEXT, allowNull: false, defaultValue: "admin_approval", field: "workflow_type" },
    selfComment: { type: DataTypes.TEXT, field: "self_comment" },
    managerComment: { type: DataTypes.TEXT, field: "manager_comment" },
    overallScore: { type: DataTypes.DECIMAL(5, 2), field: "overall_score" },
    criteriaGroupId: { type: DataTypes.INTEGER, field: "criteria_group_id" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "appraisals", timestamps: false }
);

export default Appraisal;
