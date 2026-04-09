import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface ProductCategoryAttributes {
  id: number;
  name: string;
  description: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductCategoryCreationAttributes
  extends Optional<ProductCategoryAttributes, "id" | "description"> {}

export class ProductCategory extends Model<ProductCategoryAttributes, ProductCategoryCreationAttributes> implements ProductCategoryAttributes {
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ProductCategory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    tableName: "crm_product_categories",
    underscored: true,
  }
);
