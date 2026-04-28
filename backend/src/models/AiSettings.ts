import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class AiSettings extends Model {
  declare id: number;
  declare provider: string;
  declare apiKey: string;
  declare model: string;
  declare updatedAt: Date;
}

AiSettings.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },
    provider: { type: DataTypes.TEXT, allowNull: false, defaultValue: "gemini" },
    apiKey: { type: DataTypes.TEXT, allowNull: false, defaultValue: "", field: "api_key" },
    model: { type: DataTypes.TEXT, allowNull: false, defaultValue: "gemini-2.5-flash" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "ai_settings", timestamps: false }
);

export default AiSettings;
