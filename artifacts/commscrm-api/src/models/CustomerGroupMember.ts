import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface CustomerGroupMemberAttributes {
  id: number;
  groupId: number;
  customerId: number;
}

export interface CustomerGroupMemberCreationAttributes
  extends Optional<CustomerGroupMemberAttributes, "id"> {}

export class CustomerGroupMember
  extends Model<CustomerGroupMemberAttributes, CustomerGroupMemberCreationAttributes>
  implements CustomerGroupMemberAttributes {
  declare id: number;
  declare groupId: number;
  declare customerId: number;
}

CustomerGroupMember.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    groupId: { type: DataTypes.INTEGER, allowNull: false, field: "group_id", references: { model: "crm_customer_groups", key: "id" } },
    customerId: { type: DataTypes.INTEGER, allowNull: false, field: "customer_id", references: { model: "crm_customers", key: "id" } },
  },
  {
    sequelize,
    tableName: "crm_customer_group_members",
    underscored: true,
    timestamps: false,
  }
);
