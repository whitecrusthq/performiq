import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class LeaveTypeGrade extends Model {
  declare id: number;
  declare leaveTypeId: number;
  declare gradeId: number;
}

LeaveTypeGrade.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    leaveTypeId: { type: DataTypes.INTEGER, allowNull: false, field: "leave_type_id" },
    gradeId: { type: DataTypes.INTEGER, allowNull: false, field: "grade_id" },
  },
  { sequelize, tableName: "leave_type_grades", timestamps: false }
);

export default LeaveTypeGrade;
