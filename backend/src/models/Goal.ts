import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class Goal extends Model {
  declare id: number;
  declare userId: number;
  declare cycleId: number | null;
  declare title: string;
  declare description: string | null;
  declare status: string;
  declare dueDate: string | null;
  declare progress: number;
  declare createdAt: Date;
}

Goal.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    cycleId: { type: DataTypes.INTEGER, field: "cycle_id" },
    title: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "not_started" },
    dueDate: { type: DataTypes.DATEONLY, field: "due_date" },
    progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
  },
  { sequelize, tableName: "goals", timestamps: false }
);

export default Goal;
