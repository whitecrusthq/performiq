import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class JobRequisition extends Model {
  declare id: number;
  declare title: string;
  declare department: string | null;
  declare siteId: number | null;
  declare description: string | null;
  declare requirements: string | null;
  declare employmentType: string;
  declare status: string;
  declare openings: number;
  declare hiringManagerId: number | null;
  declare createdById: number;
  declare closingDate: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

JobRequisition.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.TEXT, allowNull: false },
    department: { type: DataTypes.TEXT },
    siteId: { type: DataTypes.INTEGER, field: "site_id" },
    description: { type: DataTypes.TEXT },
    requirements: { type: DataTypes.TEXT },
    employmentType: { type: DataTypes.TEXT, allowNull: false, defaultValue: "full_time", field: "employment_type" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "draft" },
    openings: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    hiringManagerId: { type: DataTypes.INTEGER, field: "hiring_manager_id" },
    createdById: { type: DataTypes.INTEGER, allowNull: false, field: "created_by_id" },
    closingDate: { type: DataTypes.DATEONLY, field: "closing_date" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "job_requisitions", timestamps: false }
);

export default JobRequisition;
