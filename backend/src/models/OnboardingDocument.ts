import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class OnboardingDocument extends Model {
  declare id: number;
  declare workflowId: number;
  declare name: string;
  declare fileData: string | null;
  declare fileType: string | null;
  declare notes: string | null;
  declare uploadedById: number | null;
  declare createdAt: Date;
}

OnboardingDocument.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workflowId: { type: DataTypes.INTEGER, allowNull: false, field: "workflow_id" },
    name: { type: DataTypes.TEXT, allowNull: false },
    fileData: { type: DataTypes.TEXT, field: "file_data" },
    fileType: { type: DataTypes.TEXT, field: "file_type" },
    notes: { type: DataTypes.TEXT },
    uploadedById: { type: DataTypes.INTEGER, field: "uploaded_by_id" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "onboarding_documents", timestamps: false }
);

export default OnboardingDocument;
