import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class DisciplinaryAttachment extends Model {
  declare id: number;
  declare recordId: number;
  declare fileName: string;
  declare fileType: string;
  declare objectPath: string;
  declare uploadedById: number | null;
  declare createdAt: Date;
}

DisciplinaryAttachment.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    recordId: { type: DataTypes.INTEGER, allowNull: false, field: "record_id" },
    fileName: { type: DataTypes.TEXT, allowNull: false, field: "file_name" },
    fileType: { type: DataTypes.TEXT, allowNull: false, field: "file_type" },
    objectPath: { type: DataTypes.TEXT, allowNull: false, field: "object_path" },
    uploadedById: { type: DataTypes.INTEGER, field: "uploaded_by_id" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "disciplinary_attachments", timestamps: false }
);

export default DisciplinaryAttachment;
