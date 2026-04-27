import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class Document extends Model {
  declare id: number;
  declare title: string;
  declare description: string | null;
  declare category: string;
  declare objectPath: string;
  declare mimeType: string | null;
  declare fileSize: number | null;
  declare originalFilename: string | null;
  declare quizSourceText: string | null;
  declare uploadedBy: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Document.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    category: { type: DataTypes.TEXT, allowNull: false, defaultValue: "Other" },
    objectPath: { type: DataTypes.TEXT, allowNull: false, field: "object_path" },
    mimeType: { type: DataTypes.TEXT, field: "mime_type" },
    fileSize: { type: DataTypes.INTEGER, field: "file_size" },
    originalFilename: { type: DataTypes.TEXT, field: "original_filename" },
    quizSourceText: { type: DataTypes.TEXT, field: "quiz_source_text" },
    uploadedBy: { type: DataTypes.INTEGER, allowNull: false, field: "uploaded_by" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "documents", timestamps: false }
);

export default Document;
