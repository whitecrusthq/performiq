import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

/** A user configured as a selectable HR approver for the final leave-approval step. */
class LeaveHrApprover extends Model {
  declare userId: number;
  declare position: number;
  declare isDefault: boolean;
}

LeaveHrApprover.init(
  {
    userId: { type: DataTypes.INTEGER, primaryKey: true, field: "user_id" },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_default" },
  },
  { sequelize, tableName: "leave_hr_approvers", timestamps: false }
);

export default LeaveHrApprover;
