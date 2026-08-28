import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { User, sequelize } from "../models/index.js";

function canRecoverTarget(target: User, actorId: number): boolean {
  return target.id !== actorId
    && !target.isProtected
    && (target.role === "employee" || target.role === "manager");
}

export default class AccountRecoveryController {
  static async list(actorId: number) {
    const users = await User.findAll({
      where: {
        id: { [Op.ne]: actorId },
        isProtected: false,
        role: { [Op.in]: ["employee", "manager"] },
      },
      attributes: ["id", "name", "email", "twoFactorEnabled", "isActive"],
      order: [["name", "ASC"]],
    });
    return users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      twoFactorEnabled: !!u.twoFactorEnabled,
      isActive: u.isActive !== false,
    }));
  }

  static async setTemporaryPassword(id: number, actorId: number, temporaryPassword: string) {
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    return sequelize.transaction(async transaction => {
      const target = await User.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!target || !canRecoverTarget(target, actorId)) {
        return { error: "User not found", status: 404 };
      }
      await target.update({
        passwordHash,
        mustChangePassword: true,
        passwordResetCodeHash: null,
        passwordResetExpiresAt: null,
        passwordResetAttempts: 0,
        passwordResetRequestedAt: null,
        failedLoginAttempts: 0,
        isLocked: false,
        lockedAt: null,
        tokenVersion: sequelize.literal("token_version + 1") as any,
      }, { transaction });
      return { message: "Temporary password set" };
    });
  }

  static async reset2FA(id: number, actorId: number) {
    return sequelize.transaction(async transaction => {
      const target = await User.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!target || !canRecoverTarget(target, actorId)) {
        return { error: "User not found", status: 404 };
      }
      await target.update({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
        twoFactorBackupCodes: null,
        tokenVersion: sequelize.literal("token_version + 1") as any,
      }, { transaction });
      return { message: "Two-factor authentication reset" };
    });
  }
}