import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class StorageProvider extends Model {
  declare id: number;
  declare name: string;
  declare type: string;
  declare config: Record<string, any>;
  declare isDefault: boolean;
  declare isEnabled: boolean;
  declare createdBy: number | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

StorageProvider.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.TEXT, allowNull: false },
    config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_default" },
    isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_enabled" },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: "created_by" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "storage_providers", timestamps: false }
);

export default StorageProvider;
