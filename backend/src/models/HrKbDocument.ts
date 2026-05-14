import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class HrKbDocument extends Model {
  declare id: number;
  declare title: string;
  declare content: string;
  declare sourceFilename: string | null;
  declare tags: string | null;
  declare createdBy: number | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

HrKbDocument.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.TEXT, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    sourceFilename: { type: DataTypes.TEXT, field: "source_filename" },
    tags: { type: DataTypes.TEXT },
    createdBy: { type: DataTypes.INTEGER, field: "created_by" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "hr_kb_documents", timestamps: false }
);

export default HrKbDocument;
