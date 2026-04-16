import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class ConfirmationReview extends Model {
  declare id: number;
  declare employeeId: number;
  declare appraisalId: number | null;
  declare status: string;
  declare reviewDocumentPath: string | null;
  declare reviewDocumentName: string | null;
  declare reviewerNotes: string | null;
  declare initiatedBy: number;
  declare approvedBy: number | null;
  declare rejectedReason: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ConfirmationReview.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: "employee_id" },
    appraisalId: { type: DataTypes.INTEGER, field: "appraisal_id" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending_appraisal" },
    reviewDocumentPath: { type: DataTypes.TEXT, field: "review_document_path" },
    reviewDocumentName: { type: DataTypes.TEXT, field: "review_document_name" },
    reviewerNotes: { type: DataTypes.TEXT, field: "reviewer_notes" },
    initiatedBy: { type: DataTypes.INTEGER, allowNull: false, field: "initiated_by" },
    approvedBy: { type: DataTypes.INTEGER, field: "approved_by" },
    rejectedReason: { type: DataTypes.TEXT, field: "rejected_reason" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "confirmation_reviews", timestamps: false }
);

export default ConfirmationReview;
