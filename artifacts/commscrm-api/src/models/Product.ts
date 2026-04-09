import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface ProductAttributes {
  id: number;
  externalId: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  currency: string;
  categoryId: number | null;
  imageUrl: string | null;
  stockQty: number | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  sourceId: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductCreationAttributes
  extends Optional<ProductAttributes, "id" | "externalId" | "description" | "sku" | "categoryId" | "imageUrl" | "stockQty" | "isActive" | "metadata" | "sourceId" | "currency"> {}

export class Product extends Model<ProductAttributes, ProductCreationAttributes> implements ProductAttributes {
  declare id: number;
  declare externalId: string | null;
  declare name: string;
  declare description: string | null;
  declare sku: string | null;
  declare price: number;
  declare currency: string;
  declare categoryId: number | null;
  declare imageUrl: string | null;
  declare stockQty: number | null;
  declare isActive: boolean;
  declare metadata: Record<string, unknown> | null;
  declare sourceId: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare category?: { id: number; name: string };
  declare source?: { id: number; name: string };
}

Product.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    externalId: { type: DataTypes.STRING(255), allowNull: true, field: "external_id" },
    name: { type: DataTypes.STRING(500), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    sku: { type: DataTypes.STRING(100), allowNull: true },
    price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "USD" },
    categoryId: { type: DataTypes.INTEGER, allowNull: true, field: "category_id" },
    imageUrl: { type: DataTypes.TEXT, allowNull: true, field: "image_url" },
    stockQty: { type: DataTypes.INTEGER, allowNull: true, field: "stock_qty" },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
    metadata: { type: DataTypes.JSONB, allowNull: true },
    sourceId: { type: DataTypes.INTEGER, allowNull: true, field: "source_id" },
  },
  {
    sequelize,
    tableName: "crm_products",
    underscored: true,
  }
);
