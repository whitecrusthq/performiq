import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface AgentShiftAttributes {
  id: number;
  agentId: number;
  shiftName: string;
  startTime: string;
  endTime: string;
  daysOfWeek: string;
  graceMinutes: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AgentShiftCreationAttributes
  extends Optional<AgentShiftAttributes, "id" | "graceMinutes" | "isActive"> {}

export class AgentShift
  extends Model<AgentShiftAttributes, AgentShiftCreationAttributes>
  implements AgentShiftAttributes
{
  declare id: number;
  declare agentId: number;
  declare shiftName: string;
  declare startTime: string;
  declare endTime: string;
  declare daysOfWeek: string;
  declare graceMinutes: number;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AgentShift.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    agentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "agent_id",
      references: { model: "crm_agents", key: "id" },
    },
    shiftName: { type: DataTypes.STRING(100), allowNull: false, field: "shift_name" },
    startTime: { type: DataTypes.STRING(5), allowNull: false, field: "start_time" },
    endTime: { type: DataTypes.STRING(5), allowNull: false, field: "end_time" },
    daysOfWeek: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[1,2,3,4,5]", field: "days_of_week" },
    graceMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 15, field: "grace_minutes" },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
  },
  {
    sequelize,
    tableName: "crm_agent_shifts",
    underscored: true,
  }
);
