import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class StaffEducation extends Model {
  declare id: number;
  declare userId: number;
  declare schoolAttended: string;
  declare certificateObtained: string | null;
  declare fromDate: string | null;
  declare toDate: string | null;
  declare orderIndex: number;
  declare createdAt: Date;
}

StaffEducation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    schoolAttended: { type: DataTypes.TEXT, allowNull: false, field: "school_attended" },
    certificateObtained: { type: DataTypes.TEXT, field: "certificate_obtained" },
    fromDate: { type: DataTypes.TEXT, field: "from_date" },
    toDate: { type: DataTypes.TEXT, field: "to_date" },
    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "order_index" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "staff_education", timestamps: false }
);

export default StaffEducation;
