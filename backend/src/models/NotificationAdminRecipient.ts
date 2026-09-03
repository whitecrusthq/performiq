import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class NotificationAdminRecipient extends Model {
  declare userId: number;
  declare createdById: number | null;
  declare createdAt: Date;
}

NotificationAdminRecipient.init(
  {
    userId: { type: DataTypes.INTEGER, primaryKey: true, field: "user_id" },
    createdById: { type: DataTypes.INTEGER, allowNull: true, field: "created_by_id" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "notification_admin_recipients", timestamps: false },
);

export default NotificationAdminRecipient;