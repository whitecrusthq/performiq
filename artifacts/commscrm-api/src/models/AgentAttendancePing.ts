import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface AgentAttendancePingAttributes {
  id: number;
  attendanceId: number;
  agentId: number;
  lat: string;
  lng: string;
  recordedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AgentAttendancePingCreationAttributes
  extends Optional<AgentAttendancePingAttributes, "id" | "recordedAt"> {}

export class AgentAttendancePing
  extends Model<AgentAttendancePingAttributes, AgentAttendancePingCreationAttributes>
  implements AgentAttendancePingAttributes
{
  declare id: number;
  declare attendanceId: number;
  declare agentId: number;
  declare lat: string;
  declare lng: string;
  declare recordedAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AgentAttendancePing.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    attendanceId: { type: DataTypes.INTEGER, allowNull: false, field: "attendance_id" },
    agentId: { type: DataTypes.INTEGER, allowNull: false, field: "agent_id" },
    lat: { type: DataTypes.STRING(30), allowNull: false },
    lng: { type: DataTypes.STRING(30), allowNull: false },
    recordedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "recorded_at" },
  },
  {
    sequelize,
    tableName: "crm_agent_attendance_pings",
    underscored: true,
  }
);
