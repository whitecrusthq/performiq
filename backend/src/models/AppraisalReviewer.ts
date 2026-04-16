import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class AppraisalReviewer extends Model {
  declare id: number;
  declare appraisalId: number;
  declare reviewerId: number;
  declare orderIndex: number;
  declare status: string;
  declare managerComment: string | null;
  declare reviewedAt: Date | null;
  declare createdAt: Date;
}

AppraisalReviewer.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    appraisalId: { type: DataTypes.INTEGER, allowNull: false, field: "appraisal_id" },
    reviewerId: { type: DataTypes.INTEGER, allowNull: false, field: "reviewer_id" },
    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "order_index" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending" },
    managerComment: { type: DataTypes.TEXT, field: "manager_comment" },
    reviewedAt: { type: DataTypes.DATE, field: "reviewed_at" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "appraisal_reviewers", timestamps: false }
);

export default AppraisalReviewer;
