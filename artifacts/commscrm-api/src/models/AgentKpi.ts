import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface AgentKpiAttributes {
  id: number;
  agentId: number;
  period: "weekly" | "monthly";
  targetConversations: number | null;
  targetResponseTimeMins: number | null;
  targetResolutionRate: number | null;
  targetCsatScore: number | null;
  targetReopenRate: number | null;
  targetHandleTimeMins: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AgentKpiCreationAttributes
  extends Optional<
    AgentKpiAttributes,
    | "id"
    | "targetConversations"
    | "targetResponseTimeMins"
    | "targetResolutionRate"
    | "targetCsatScore"
    | "targetReopenRate"
    | "targetHandleTimeMins"
  > {}

export class AgentKpi
  extends Model<AgentKpiAttributes, AgentKpiCreationAttributes>
  implements AgentKpiAttributes
{
  declare id: number;
  declare agentId: number;
  declare period: "weekly" | "monthly";
  declare targetConversations: number | null;
  declare targetResponseTimeMins: number | null;
  declare targetResolutionRate: number | null;
  declare targetCsatScore: number | null;
  declare targetReopenRate: number | null;
  declare targetHandleTimeMins: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AgentKpi.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    agentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "agent_id",
      references: { model: "crm_agents", key: "id" },
    },
    period: {
      type: DataTypes.ENUM("weekly", "monthly"),
      allowNull: false,
      defaultValue: "weekly",
    },
    targetConversations: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "target_conversations",
    },
    targetResponseTimeMins: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "target_response_time_mins",
    },
    targetResolutionRate: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "target_resolution_rate",
    },
    targetCsatScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "target_csat_score",
    },
    targetReopenRate: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "target_reopen_rate",
    },
    targetHandleTimeMins: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "target_handle_time_mins",
    },
  },
  {
    sequelize,
    tableName: "crm_agent_kpis",
    underscored: true,
  }
);
