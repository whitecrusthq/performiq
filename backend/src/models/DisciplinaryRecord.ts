import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class DisciplinaryRecord extends Model {
  declare id: number;
  declare userId: number;
  declare type: string;
  declare subject: string;
  declare description: string | null;
  declare sanctionApplied: string | null;
  declare severity: string;
  declare incidentDate: string | null;
  declare createdById: number | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

DisciplinaryRecord.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    type: { type: DataTypes.TEXT, allowNull: false, defaultValue: "disciplinary" },
    subject: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    sanctionApplied: { type: DataTypes.TEXT, field: "sanction_applied" },
    severity: { type: DataTypes.TEXT, allowNull: false, defaultValue: "minor" },
    incidentDate: { type: DataTypes.DATEONLY, field: "incident_date" },
    createdById: { type: DataTypes.INTEGER, field: "created_by_id" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "disciplinary_records", timestamps: false }
);

export default DisciplinaryRecord;
