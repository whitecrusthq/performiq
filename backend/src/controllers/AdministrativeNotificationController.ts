import { Op } from "sequelize";
import { NotificationAdminRecipient, User, sequelize } from "../models/index.js";

export default class AdministrativeNotificationController {
  static async list() {
    const [admins, selectedRows] = await Promise.all([
      User.findAll({
        where: { role: { [Op.in]: ["admin", "super_admin"] }, isActive: true },
        attributes: ["id", "name", "email", "role", "isProtected"],
        order: [["name", "ASC"]],
      }),
      NotificationAdminRecipient.findAll({ attributes: ["userId"] }),
    ]);
    const selectedIds = new Set(selectedRows.map(row => row.userId));
    return admins.map((admin: any) => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isProtected: !!admin.isProtected,
      selected: selectedIds.has(admin.id),
    }));
  }

  static async update(userIdsInput: unknown, actorId: number) {
    if (!Array.isArray(userIdsInput)) return { error: "userIds must be an array", status: 400 };
    const userIds = [...new Set(userIdsInput.map(Number))];
    if (userIds.length > 500 || userIds.some(id => !Number.isInteger(id) || id <= 0)) {
      return { error: "Invalid administrator selection", status: 400 };
    }
    if (userIds.length > 0) {
      const eligible = await User.count({
        where: { id: { [Op.in]: userIds }, role: { [Op.in]: ["admin", "super_admin"] }, isActive: true },
      });
      if (eligible !== userIds.length) {
        return { error: "Only active Admin and Super Admin users can receive administrative alerts", status: 400 };
      }
    }

    await sequelize.transaction(async transaction => {
      await NotificationAdminRecipient.destroy({ where: {}, transaction });
      if (userIds.length > 0) {
        await NotificationAdminRecipient.bulkCreate(
          userIds.map(userId => ({ userId, createdById: actorId })),
          { transaction },
        );
      }
    });
    return { data: { selectedIds: userIds } };
  }
}