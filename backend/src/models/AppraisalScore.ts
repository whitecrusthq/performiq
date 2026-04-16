import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class AppraisalScore extends Model {
  declare id: number;
  declare appraisalId: number;
  declare criterionId: number;
  declare selfScore: string | null;
  declare managerScore: string | null;
  declare selfNote: string | null;
  declare managerNote: string | null;
  declare actualValue: string | null;
  declare adminActualValue: string | null;
  declare acceptedValue: string | null;
  declare budgetValue: string | null;
}

AppraisalScore.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    appraisalId: { type: DataTypes.INTEGER, allowNull: false, field: "appraisal_id" },
    criterionId: { type: DataTypes.INTEGER, allowNull: false, field: "criterion_id" },
    selfScore: { type: DataTypes.DECIMAL(5, 2), field: "self_score" },
    managerScore: { type: DataTypes.DECIMAL(5, 2), field: "manager_score" },
    selfNote: { type: DataTypes.TEXT, field: "self_note" },
    managerNote: { type: DataTypes.TEXT, field: "manager_note" },
    actualValue: { type: DataTypes.DECIMAL(15, 2), field: "actual_value" },
    adminActualValue: { type: DataTypes.DECIMAL(15, 2), field: "admin_actual_value" },
    acceptedValue: { type: DataTypes.TEXT, field: "accepted_value" },
    budgetValue: { type: DataTypes.DECIMAL(15, 2), field: "budget_value" },
  },
  { sequelize, tableName: "appraisal_scores", timestamps: false }
);

export default AppraisalScore;
