import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface SiteAttributes {
  id: number;
  name: string;
  description: string | null;
  region: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SiteCreationAttributes
  extends Optional<SiteAttributes, "id" | "description" | "region" | "isActive"> {}

export class Site extends Model<SiteAttributes, SiteCreationAttributes> implements SiteAttributes {
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare region: string | null;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Site.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    region: { type: DataTypes.STRING(100), allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
  },
  {
    sequelize,
    tableName: "crm_sites",
    underscored: true,
  }
);
