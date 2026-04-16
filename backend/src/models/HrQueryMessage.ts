import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class HrQueryMessage extends Model {
  declare id: number;
  declare queryId: number;
  declare senderId: number;
  declare body: string;
  declare createdAt: Date;
}

HrQueryMessage.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    queryId: { type: DataTypes.INTEGER, allowNull: false, field: "query_id" },
    senderId: { type: DataTypes.INTEGER, allowNull: false, field: "sender_id" },
    body: { type: DataTypes.TEXT, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "hr_query_messages", timestamps: false }
);

export default HrQueryMessage;
