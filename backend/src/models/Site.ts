import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class Site extends Model {
  declare id: number;
  declare name: string;
  declare address: string | null;
  declare city: string | null;
  declare region: string | null;
  declare country: string | null;
  declare description: string | null;
  declare require2Fa: boolean;
  declare createdAt: Date;
}

Site.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false, unique: true },
    address: { type: DataTypes.TEXT },
    city: { type: DataTypes.TEXT },
    region: { type: DataTypes.TEXT },
    country: { type: DataTypes.TEXT },
    description: { type: DataTypes.TEXT },
    require2Fa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "require_2fa" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "sites", timestamps: false }
);

export default Site;
