import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class QuizAttempt extends Model {
  declare id: number;
  declare userId: number;
  declare documentId: number;
  declare score: number;
  declare total: number;
  declare percent: number;
  declare passed: boolean;
  declare answers: any;
  declare completedAt: Date;
}

QuizAttempt.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    documentId: { type: DataTypes.INTEGER, allowNull: false, field: "document_id" },
    score: { type: DataTypes.INTEGER, allowNull: false },
    total: { type: DataTypes.INTEGER, allowNull: false },
    percent: { type: DataTypes.INTEGER, allowNull: false },
    passed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    answers: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    completedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "completed_at" },
  },
  { sequelize, tableName: "quiz_attempts", timestamps: false }
);

export default QuizAttempt;
