import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class LegalDocument extends Model {
  declare id: number;
  declare privacyContent: string;
  declare privacyPublished: boolean;
  declare privacyUpdatedAt: Date | null;
  declare termsContent: string;
  declare termsVersion: number;
  declare termsPublished: boolean;
  declare termsUpdatedAt: Date | null;
  declare updatedAt: Date;
}

LegalDocument.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },
    privacyContent: { type: DataTypes.TEXT, allowNull: false, defaultValue: "", field: "privacy_content" },
    privacyPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "privacy_published" },
    privacyUpdatedAt: { type: DataTypes.DATE, allowNull: true, field: "privacy_updated_at" },
    termsContent: { type: DataTypes.TEXT, allowNull: false, defaultValue: "", field: "terms_content" },
    termsVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "terms_version" },
    termsPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "terms_published" },
    termsUpdatedAt: { type: DataTypes.DATE, allowNull: true, field: "terms_updated_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "legal_documents", timestamps: false }
);

export default LegalDocument;
