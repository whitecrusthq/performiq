import { QueryInterface, DataTypes } from "sequelize";

export async function up(qi: QueryInterface) {
  const table: any = await qi.describeTable("hr_queries");
  const add = async (col: string, def: any) => {
    if (!table[col]) await qi.addColumn("hr_queries", col, def);
  };
  await add("first_response_at", { type: DataTypes.DATE, allowNull: true });
  await add("resolved_at", { type: DataTypes.DATE, allowNull: true });
  await add("closed_at", { type: DataTypes.DATE, allowNull: true });
  await add("escalated_at", { type: DataTypes.DATE, allowNull: true });
  await add("escalated_by", { type: DataTypes.INTEGER, allowNull: true });
  await add("escalation_reason", { type: DataTypes.TEXT, allowNull: true });
  await add("transferred_at", { type: DataTypes.DATE, allowNull: true });
  await add("transferred_by", { type: DataTypes.INTEGER, allowNull: true });
  await add("transfer_reason", { type: DataTypes.TEXT, allowNull: true });
}

export async function down(qi: QueryInterface) {
  for (const col of [
    "first_response_at", "resolved_at", "closed_at",
    "escalated_at", "escalated_by", "escalation_reason",
    "transferred_at", "transferred_by", "transfer_reason",
  ]) {
    await qi.removeColumn("hr_queries", col).catch(() => {});
  }
}
