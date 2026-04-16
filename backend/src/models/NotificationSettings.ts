import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class NotificationSettings extends Model {
  declare id: number;
  declare platform: string;
  declare enabled: boolean;
  declare config: Record<string, any>;
  declare updatedAt: Date;
  declare updatedById: string | null;
}

NotificationSettings.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    platform: { type: DataTypes.TEXT, allowNull: false },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
    updatedById: { type: DataTypes.TEXT, field: "updated_by_id" },
  },
  { sequelize, tableName: "notification_settings", timestamps: false }
);

export default NotificationSettings;
