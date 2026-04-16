import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class StaffWorkExperience extends Model {
  declare id: number;
  declare userId: number;
  declare companyName: string;
  declare companyAddress: string | null;
  declare positionHeld: string | null;
  declare fromDate: string | null;
  declare toDate: string | null;
  declare reasonForLeaving: string | null;
  declare orderIndex: number;
  declare createdAt: Date;
}

StaffWorkExperience.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    companyName: { type: DataTypes.TEXT, allowNull: false, field: "company_name" },
    companyAddress: { type: DataTypes.TEXT, field: "company_address" },
    positionHeld: { type: DataTypes.TEXT, field: "position_held" },
    fromDate: { type: DataTypes.TEXT, field: "from_date" },
    toDate: { type: DataTypes.TEXT, field: "to_date" },
    reasonForLeaving: { type: DataTypes.TEXT, field: "reason_for_leaving" },
    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "order_index" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "staff_work_experience", timestamps: false }
);

export default StaffWorkExperience;
