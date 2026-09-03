import { Op } from "sequelize";
import { User, SecuritySettings, sequelize } from "../models/index.js";

export default class SecurityController {
  static async getSettings() {
    const row = await SecuritySettings.findOne({ where: { id: 1 } });
    if (row) return row;
    const inserted = await SecuritySettings.create({ id: 1, lockoutEnabled: true, maxAttempts: 5, lockoutDurationMinutes: 30 });
    return inserted;
  }

  static async updateSettings(data: {
    lockoutEnabled?: boolean;
    maxAttempts?: number;
    lockoutDurationMinutes?: number;
    enforce2faAll?: boolean;
    enforce2faRoles?: string[] | null;
    idleTimeoutMinutes?: number;
  }) {
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (typeof data.lockoutEnabled === "boolean") updates.lockoutEnabled = data.lockoutEnabled;
    if (typeof data.maxAttempts === "number" && data.maxAttempts >= 1 && data.maxAttempts <= 50) updates.maxAttempts = data.maxAttempts;
    if (typeof data.lockoutDurationMinutes === "number" && data.lockoutDurationMinutes >= 1) updates.lockoutDurationMinutes = data.lockoutDurationMinutes;
    if (typeof data.idleTimeoutMinutes === "number" && data.idleTimeoutMinutes >= 1 && data.idleTimeoutMinutes <= 1440) updates.idleTimeoutMinutes = data.idleTimeoutMinutes;
    if (typeof data.enforce2faAll === "boolean") updates.enforce2faAll = data.enforce2faAll;
    if (data.enforce2faRoles === null) {
      updates.enforce2faRoles = null;
    } else if (Array.isArray(data.enforce2faRoles)) {
      const allowed = ["super_admin", "admin", "manager", "employee"];
      const filtered = data.enforce2faRoles.filter(r => allowed.includes(r));
      updates.enforce2faRoles = JSON.stringify(filtered);
    }
    const [, rows] = await SecuritySettings.update(updates, { where: { id: 1 }, returning: true });
    return rows[0];
  }

  static async getLockedAccounts(actorId: number) {
    const actor: any = await User.findByPk(actorId, { attributes: ["id", "role"] });
    if (!actor) return [];
    return User.findAll({
      where: actor.role === "super_admin"
        ? { isLocked: true }
        : { isLocked: true, isProtected: false, role: { [Op.ne]: "super_admin" } },
      attributes: ["id", "name", "email", "role", "department", "lockedAt", "failedLoginAttempts"],
      order: [["lockedAt", "DESC"], ["name", "ASC"]],
    });
  }

  static async unlockAccount(userId: number, actorId: number) {
    const [actor, target]: any[] = await Promise.all([
      User.findByPk(actorId, { attributes: ["id", "role"] }),
      User.findByPk(userId, { attributes: ["id", "name", "email", "role", "isProtected", "isLocked"] }),
    ]);
    if (!actor || !target || !target.isLocked) return { error: "Locked account not found", status: 404 };
    if (actor.role !== "super_admin" && (target.isProtected || target.role === "super_admin")) {
      return { error: "Locked account not found", status: 404 };
    }
    const [count, rows] = await User.update(
      { isLocked: false, failedLoginAttempts: 0, lockedAt: null },
      { where: { id: userId }, returning: true }
    );
    if (count === 0) return { error: "Locked account not found", status: 404 };
    const u = rows[0];
    return { data: { id: u.id, name: u.name, email: u.email } };
  }

  static async bulkUnlockAccounts(userIdsInput: unknown, actorId: number) {
    if (!Array.isArray(userIdsInput)) return { error: "userIds must be an array", status: 400 };
    const userIds = [...new Set(userIdsInput.map(Number))];
    if (userIds.length === 0 || userIds.length > 500 || userIds.some(id => !Number.isInteger(id) || id <= 0)) {
      return { error: "Select between 1 and 500 valid accounts", status: 400 };
    }

    return sequelize.transaction(async transaction => {
      const actor: any = await User.findByPk(actorId, { attributes: ["id", "role"], transaction });
      const targets: any[] = await User.findAll({
        where: { id: { [Op.in]: userIds }, isLocked: true },
        attributes: ["id", "role", "isProtected"],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!actor || targets.length !== userIds.length) {
        return { error: "One or more locked accounts were not found", status: 404 };
      }
      if (actor.role !== "super_admin" && targets.some(target => target.isProtected || target.role === "super_admin")) {
        return { error: "One or more locked accounts were not found", status: 404 };
      }
      await User.update(
        { isLocked: false, failedLoginAttempts: 0, lockedAt: null },
        { where: { id: { [Op.in]: userIds } }, transaction },
      );
      return { data: { updated: userIds.length } };
    });
  }
}
