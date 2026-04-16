import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class StaffDocument extends Model {
  declare id: number;
  declare userId: number;
  declare name: string;
  declare documentType: string;
  declare receivedDate: string | null;
  declare notes: string | null;
  declare uploadedById: number | null;
  declare createdAt: Date;
}

StaffDocument.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    name: { type: DataTypes.TEXT, allowNull: false },
    documentType: { type: DataTypes.TEXT, allowNull: false, defaultValue: "other", field: "document_type" },
    receivedDate: { type: DataTypes.DATEONLY, field: "received_date" },
    notes: { type: DataTypes.TEXT },
    uploadedById: { type: DataTypes.INTEGER, field: "uploaded_by_id" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "staff_documents", timestamps: false }
);

export default StaffDocument;
