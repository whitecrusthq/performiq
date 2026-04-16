import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class CustomRole extends Model {
  declare id: number;
  declare name: string;
  declare permissionLevel: string;
  declare description: string | null;
  declare menuPermissions: string;
  declare createdAt: Date;
}

CustomRole.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false, unique: true },
    permissionLevel: { type: DataTypes.TEXT, allowNull: false, defaultValue: "employee", field: "permission_level" },
    description: { type: DataTypes.TEXT },
    menuPermissions: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]", field: "menu_permissions" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "custom_roles", timestamps: false }
);

export default CustomRole;
