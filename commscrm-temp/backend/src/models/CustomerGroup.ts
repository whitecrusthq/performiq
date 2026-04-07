import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export type GroupType = "smart" | "manual";

export interface SmartFilters {
  channels?: string[];
  activeWithinDays?: number | null;
  hasOpenConversation?: boolean;
}

export interface CustomerGroupAttributes {
  id: number;
  name: string;
  description: string | null;
  type: GroupType;
  filters: SmartFilters | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustomerGroupCreationAttributes
  extends Optional<CustomerGroupAttributes, "id" | "description" | "filters"> {}

export class CustomerGroup
  extends Model<CustomerGroupAttributes, CustomerGroupCreationAttributes>
  implements CustomerGroupAttributes {
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare type: GroupType;
  declare filters: SmartFilters | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

CustomerGroup.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "manual" },
    filters: { type: DataTypes.JSONB, allowNull: true },
  },
  {
    sequelize,
    tableName: "crm_customer_groups",
    underscored: true,
  }
);
