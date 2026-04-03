import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface KnowledgeDocAttributes {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  content: string;
  sizeBytes: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface KnowledgeDocCreationAttributes
  extends Optional<KnowledgeDocAttributes, "id"> {}

export class KnowledgeDoc extends Model<KnowledgeDocAttributes, KnowledgeDocCreationAttributes> implements KnowledgeDocAttributes {
  declare id: number;
  declare filename: string;
  declare originalName: string;
  declare mimeType: string;
  declare content: string;
  declare sizeBytes: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

KnowledgeDoc.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    filename: { type: DataTypes.STRING(255), allowNull: false },
    originalName: { type: DataTypes.STRING(255), allowNull: false, field: "original_name" },
    mimeType: { type: DataTypes.STRING(100), allowNull: false, field: "mime_type" },
    content: { type: DataTypes.TEXT, allowNull: false },
    sizeBytes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "size_bytes" },
  },
  {
    sequelize,
    tableName: "crm_knowledge_docs",
    underscored: true,
  }
);
