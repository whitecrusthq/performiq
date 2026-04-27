import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class DocumentQuestion extends Model {
  declare id: number;
  declare documentId: number;
  declare question: string;
  declare choices: string[];
  declare correctIndex: number;
  declare source: string;
  declare createdBy: number;
  declare createdAt: Date;
}

DocumentQuestion.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    documentId: { type: DataTypes.INTEGER, allowNull: false, field: "document_id" },
    question: { type: DataTypes.TEXT, allowNull: false },
    choices: { type: DataTypes.JSONB, allowNull: false },
    correctIndex: { type: DataTypes.INTEGER, allowNull: false, field: "correct_index" },
    source: { type: DataTypes.TEXT, allowNull: false, defaultValue: "manual" },
    createdBy: { type: DataTypes.INTEGER, allowNull: false, field: "created_by" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "document_questions", timestamps: false }
);

export default DocumentQuestion;
