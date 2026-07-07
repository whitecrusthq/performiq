import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn("attendance_logs", "clock_in_location_source", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await queryInterface.addColumn("attendance_logs", "clock_out_location_source", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn("attendance_logs", "clock_in_location_source");
  await queryInterface.removeColumn("attendance_logs", "clock_out_location_source");
}
