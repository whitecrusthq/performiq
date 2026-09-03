import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { RecoveryRequest, User, sequelize } from "../models/index.js";
import { auditRecovery, expirePending, RecoveryRequestContext } from "../lib/account-recovery.js";

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

  static async listRequests(actorId: number, status: string, context: RecoveryRequestContext) {
    const actor = await User.findByPk(actorId, { attributes: ["id", "role", "isActive"] });
    if (!actor || actor.isActive === false || !["admin", "super_admin"].includes(actor.role)) {
      return { error: "Forbidden", status: 403 } as const;
    }
    const pending = await RecoveryRequest.findAll({ where: { status: "pending" } });
    for (const request of pending) await expirePending(request, context);
    const where: any = status === "all" ? {} : { status };
    if (actor.role !== "super_admin") where.elevated = false;
    const requests = await RecoveryRequest.findAll({ where, order: [["createdAt", "DESC"]] });
    const users = await User.findAll({
      where: { id: { [Op.in]: requests.map(request => request.userId) } },
      attributes: ["id", "name", "email", "role", "isProtected"],
    });
    const byId = new Map(users.map(user => [user.id, user]));
    return requests.filter(request => {
      const user = byId.get(request.userId);
      return actor.role === "super_admin"
        || (!request.elevated && !!user && !user.isProtected && !["admin", "super_admin"].includes(user.role));
    }).map(request => {
      const user = byId.get(request.userId);
      return {
        id: request.id, userId: request.userId, status: request.status,
        expiresAt: request.expiresAt, createdAt: request.createdAt, updatedAt: request.updatedAt,
        recurrenceCount: request.recurrenceCount, riskFlag: request.riskFlag, elevated: request.elevated,
        ipAddress: request.ipAddress, userAgent: request.userAgent,
        resolvedBy: request.resolvedBy, resolvedAt: request.resolvedAt, rejectionReason: request.rejectionReason,
        user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, isProtected: user.isProtected } : null,
      };
    });
  }

  static async resolveRequest(
    id: number, actorId: number, decision: "approved" | "rejected",
    reason: string | null, context: RecoveryRequestContext,
  ) {
    return sequelize.transaction(async transaction => {
      const actor = await User.findByPk(actorId, { transaction, attributes: ["id", "role", "isActive"] });
      // All mutating recovery flows lock User then RecoveryRequest. Read the ID
      // first without a lock solely to establish that ordering.
      const candidate = await RecoveryRequest.findByPk(id, { transaction, attributes: ["id", "userId"] });
      const target = candidate
        ? await User.findByPk(candidate.userId, { transaction, lock: transaction.LOCK.UPDATE })
        : null;
      const request = candidate
        ? await RecoveryRequest.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
        : null;
      if (!actor || actor.isActive === false || !["admin", "super_admin"].includes(actor.role)) {
        return { error: "Forbidden", status: 403 } as const;
      }
      const currentlyElevated = !!target && (target.isProtected || ["admin", "super_admin"].includes(target.role));
      if (!request || !target || ((request.elevated || currentlyElevated) && actor.role !== "super_admin")) {
        return { error: "Recovery request not found", status: 404 } as const;
      }
      if (await expirePending(request, context, transaction) || request.status !== "pending") {
        return { error: "Recovery request is no longer pending", status: 409 } as const;
      }
      await request.update({
        status: decision, resolvedBy: actorId, resolvedAt: new Date(),
        rejectionReason: decision === "rejected" ? reason : null,
      }, { transaction });
      await User.update(
        { tokenVersion: sequelize.literal("token_version + 1") as any },
        { where: { id: request.userId }, transaction },
      );
      await auditRecovery(decision === "approved" ? "approve" : "reject", request.userId, context, {
        requestId: request.id, actorId, detail: decision === "rejected" ? reason : null, transaction,
      });
      return { id: request.id, status: decision };
    });
  }

  static async publicStatus(
    userId: number, requestId: number, tokenVersion: number, context: RecoveryRequestContext,
  ) {
    const user = await User.findByPk(userId, { attributes: ["id", "tokenVersion", "isActive"] });
    const request = await RecoveryRequest.findOne({ where: { id: requestId, userId } });
    if (!user || user.isActive === false || !request || user.tokenVersion !== tokenVersion) {
      return { error: "Invalid or expired recovery token", status: 401 } as const;
    }
    await expirePending(request, context);
    return { id: request.id, status: request.status, expiresAt: request.expiresAt, riskFlag: request.riskFlag };
  }

  static async report(
    userId: number, requestId: number, tokenVersion: number, context: RecoveryRequestContext,
  ) {
    return sequelize.transaction(async transaction => {
      const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
      const request = await RecoveryRequest.findOne({
        where: { id: requestId, userId }, transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!user || user.isActive === false || !request || user.tokenVersion !== tokenVersion) {
        return { error: "Invalid or expired recovery token", status: 401 } as const;
      }
      if (await expirePending(request, context, transaction) || request.status !== "pending") {
        return { error: "Recovery request is no longer pending", status: 409 } as const;
      }
      await request.update({
        status: "rejected", resolvedAt: new Date(), rejectionReason: "Reported by account owner",
      }, { transaction });
      await user.update({ tokenVersion: sequelize.literal("token_version + 1") as any }, { transaction });
      await auditRecovery("report", userId, context, { requestId, actorId: userId, transaction });
      return { message: "Recovery reported. Complete a new password reset before signing in." };
    });
  }
}