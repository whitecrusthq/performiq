import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class TransferRequest extends Model {
  declare id: number;
  declare employeeId: number;
  declare fromSiteId: number | null;
  declare toSiteId: number;
  declare fromDepartment: string | null;
  declare toDepartment: string | null;
  declare reason: string;
  declare effectiveDate: string;
  declare endDate: string | null;
  declare status: string;
  declare requestedById: number;
  declare approvedById: number | null;
  declare approvalNotes: string | null;
  declare approvedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

TransferRequest.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: "employee_id" },
    fromSiteId: { type: DataTypes.INTEGER, field: "from_site_id" },
    toSiteId: { type: DataTypes.INTEGER, allowNull: false, field: "to_site_id" },
    fromDepartment: { type: DataTypes.TEXT, field: "from_department" },
    toDepartment: { type: DataTypes.TEXT, field: "to_department" },
    reason: { type: DataTypes.TEXT, allowNull: false },
    effectiveDate: { type: DataTypes.TEXT, allowNull: false, field: "effective_date" },
    endDate: { type: DataTypes.TEXT, field: "end_date" },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending" },
    requestedById: { type: DataTypes.INTEGER, allowNull: false, field: "requested_by_id" },
    approvedById: { type: DataTypes.INTEGER, field: "approved_by_id" },
    approvalNotes: { type: DataTypes.TEXT, field: "approval_notes" },
    approvedAt: { type: DataTypes.DATE, field: "approved_at" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "transfer_requests", timestamps: false }
);

export default TransferRequest;
