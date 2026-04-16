import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class StaffReminder extends Model {
  declare id: number;
  declare userId: number | null;
  declare title: string;
  declare reminderType: string;
  declare reminderDate: string;
  declare recurring: boolean;
  declare notes: string | null;
  declare createdById: number | null;
  declare createdAt: Date;
}

StaffReminder.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, field: "user_id" },
    title: { type: DataTypes.TEXT, allowNull: false },
    reminderType: { type: DataTypes.TEXT, allowNull: false, defaultValue: "other", field: "reminder_type" },
    reminderDate: { type: DataTypes.DATEONLY, allowNull: false, field: "reminder_date" },
    recurring: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    notes: { type: DataTypes.TEXT },
    createdById: { type: DataTypes.INTEGER, field: "created_by_id" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "staff_reminders", timestamps: false }
);

export default StaffReminder;
