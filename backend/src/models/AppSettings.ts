import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class AppSettings extends Model {
  declare id: number;
  declare companyName: string;
  declare logoLetter: string;
  declare primaryHsl: string;
  declare themeName: string;
  declare loginHeadline: string;
  declare loginSubtext: string;
  declare loginBgFrom: string;
  declare loginBgTo: string;
  declare updatedAt: Date;
}

AppSettings.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },
    companyName: { type: DataTypes.TEXT, allowNull: false, defaultValue: "PerformIQ", field: "company_name" },
    logoLetter: { type: DataTypes.TEXT, allowNull: false, defaultValue: "P", field: "logo_letter" },
    primaryHsl: { type: DataTypes.TEXT, allowNull: false, defaultValue: "221 83% 53%", field: "primary_hsl" },
    themeName: { type: DataTypes.TEXT, allowNull: false, defaultValue: "blue", field: "theme_name" },
    loginHeadline: { type: DataTypes.TEXT, allowNull: false, defaultValue: "Elevate Your Team's Performance.", field: "login_headline" },
    loginSubtext: { type: DataTypes.TEXT, allowNull: false, defaultValue: "PerformIQ streamlines appraisals, goals, and feedback into one elegant platform.", field: "login_subtext" },
    loginBgFrom: { type: DataTypes.TEXT, allowNull: false, defaultValue: "", field: "login_bg_from" },
    loginBgTo: { type: DataTypes.TEXT, allowNull: false, defaultValue: "", field: "login_bg_to" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "app_settings", timestamps: false }
);

export default AppSettings;
