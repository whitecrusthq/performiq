import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class AppraisalReviewerScore extends Model {
  declare id: number;
  declare appraisalId: number;
  declare reviewerId: number;
  declare criterionId: number;
  declare score: string | null;
  declare note: string | null;
  declare actualValue: string | null;
  declare createdAt: Date;
}

AppraisalReviewerScore.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    appraisalId: { type: DataTypes.INTEGER, allowNull: false, field: "appraisal_id" },
    reviewerId: { type: DataTypes.INTEGER, allowNull: false, field: "reviewer_id" },
    criterionId: { type: DataTypes.INTEGER, allowNull: false, field: "criterion_id" },
    score: { type: DataTypes.DECIMAL(5, 2) },
    note: { type: DataTypes.TEXT },
    actualValue: { type: DataTypes.DECIMAL(15, 2), field: "actual_value" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "appraisal_reviewer_scores", timestamps: false }
);

export default AppraisalReviewerScore;
