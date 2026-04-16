import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class LeaveAllocation extends Model {
  declare id: number;
  declare employeeId: number;
  declare leaveType: string;
  declare policyId: number | null;
  declare allocated: number;
  declare used: number;
  declare cycleYear: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

LeaveAllocation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: "employee_id" },
    leaveType: { type: DataTypes.TEXT, allowNull: false, field: "leave_type" },
    policyId: { type: DataTypes.INTEGER, field: "policy_id" },
    allocated: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    used: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cycleYear: { type: DataTypes.INTEGER, allowNull: false, field: "cycle_year" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "leave_allocations", timestamps: false }
);

export default LeaveAllocation;
