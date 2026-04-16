import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class CriteriaGroupItem extends Model {
  declare id: number;
  declare groupId: number;
  declare criterionId: number;
}

CriteriaGroupItem.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    groupId: { type: DataTypes.INTEGER, allowNull: false, field: "group_id" },
    criterionId: { type: DataTypes.INTEGER, allowNull: false, field: "criterion_id" },
  },
  { sequelize, tableName: "criteria_group_items", timestamps: false }
);

export default CriteriaGroupItem;
