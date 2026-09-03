import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { RecoveryAuditLog, RecoveryRequest, User, sequelize } from "../../models/index.js";
import { sendPasswordResetCodeEmail } from "../../lib/mailgun.js";
import { auditRecovery, expirePending, notifyRecoveryAdmins, recoveryContext } from "../../lib/account-recovery.js";

const GENERIC_REQUEST = { message: "If an account exists for that email, a password reset code has been sent." };
const GENERIC_COMPLETE = "Invalid or expired password reset code";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const resetKey = process.env.PASSWORD_RESET_HMAC_KEY || process.env.JWT_SECRET;

function codeHash(code: string): string {
  if (!resetKey) throw new Error("Password reset signing key is not configured");
  return crypto.createHmac("sha256", resetKey).update(code).digest("hex");
}

export class PasswordResetAction {
  static async request(req: Request, res: Response) {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";
    if (!EMAIL_RE.test(email)) { res.status(400).json({ error: "A valid email is required" }); return; }
    try {
      const now = Date.now();
      const context = recoveryContext(req);
      const delivery = await sequelize.transaction(async tx => {
        const user = await User.findOne({ where: { email }, transaction: tx, lock: tx.LOCK.UPDATE });
        if (!user || user.isActive === false
          || (user.passwordResetRequestedAt && now - new Date(user.passwordResetRequestedAt).getTime() < 60_000)) return null;
        const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
        await User.update({
          passwordResetCodeHash: codeHash(code), passwordResetExpiresAt: new Date(now + 10 * 60_000),
          passwordResetAttempts: 0, passwordResetRequestedAt: new Date(now),
        }, { where: { id: user.id }, transaction: tx });
        await auditRecovery("reset_requested", user.id, context, { transaction: tx });
        const since = new Date(now - 24 * 60 * 60_000);
        const count = await RecoveryAuditLog.count({
          where: { userId: user.id, event: "reset_requested", createdAt: { [Op.gte]: since } },
          transaction: tx,
        });
        let threshold = false;
        if (count >= 3) {
          const alreadyAlerted = await RecoveryAuditLog.count({
            where: { userId: user.id, event: "reset_threshold_alert", createdAt: { [Op.gte]: since } },
            transaction: tx,
          });
          if (!alreadyAlerted) {
            await auditRecovery("reset_threshold_alert", user.id, context, {
              detail: `${count} reset requests in 24 hours`, transaction: tx,
            });
            threshold = true;
          }
        }
        return {
          email: user.email, name: user.name, code, threshold,
          elevated: user.isProtected || user.role === "admin" || user.role === "super_admin",
        };
      });
      if (delivery) {
        void sendPasswordResetCodeEmail(delivery.email, delivery.code, delivery.name).catch(() => undefined);
        if (delivery.threshold) void notifyRecoveryAdmins(
          "Password reset risk threshold reached",
          delivery.elevated
            ? "A protected or elevated account has reached at least 3 password reset requests in 24 hours. Super Admin review is required."
            : `An account has reached at least 3 password reset requests in 24 hours: ${delivery.email}`,
          delivery.elevated,
        );
      }
    } catch {
      // Deliberately preserve the same result for database/provider failures.
    }
    res.json(GENERIC_REQUEST);
  }

  static async complete(req: Request, res: Response) {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    const newPassword = req.body?.newPassword;
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code) || typeof newPassword !== "string" || newPassword.length < 8) {
      res.status(400).json({ error: "Email, a 6-digit code, and a new password of at least 8 characters are required" }); return;
    }
    try {
      const context = recoveryContext(req);
      const outcome = await sequelize.transaction(async tx => {
        const user = await User.findOne({ where: { email }, transaction: tx, lock: tx.LOCK.UPDATE });
        const invalid = { error: GENERIC_COMPLETE, status: 400 } as const;
        if (!user || user.isActive === false || !user.passwordResetCodeHash || !user.passwordResetExpiresAt
          || new Date(user.passwordResetExpiresAt).getTime() < Date.now() || user.passwordResetAttempts >= 5) return invalid;
        const supplied = codeHash(code);
        const expected = user.passwordResetCodeHash;
        const valid = supplied.length === expected.length
          && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
        if (!valid) {
          const attempts = user.passwordResetAttempts + 1;
          await User.update({
            passwordResetAttempts: attempts,
            ...(attempts >= 5 ? { passwordResetCodeHash: null, passwordResetExpiresAt: null } : {}),
          }, { where: { id: user.id }, transaction: tx });
          return invalid;
        }
        await User.update({
          passwordHash: await bcrypt.hash(newPassword, 10),
          passwordResetCodeHash: null, passwordResetExpiresAt: null, passwordResetAttempts: 0, passwordResetRequestedAt: null,
          mustChangePassword: false, failedLoginAttempts: 0, isLocked: false, lockedAt: null,
          tokenVersion: sequelize.literal("token_version + 1") as any,
        }, { where: { id: user.id }, transaction: tx });
        const existing = await RecoveryRequest.findOne({
          where: { userId: user.id, status: "pending" }, transaction: tx, lock: tx.LOCK.UPDATE,
        });
        const existingRecurrence = existing?.recurrenceCount ?? null;
        if (existing) await expirePending(existing, context, tx);
        const recurrenceCount = existing?.status === "pending" && existingRecurrence !== null
          ? existingRecurrence + 1
          : await RecoveryRequest.count({ where: { userId: user.id }, transaction: tx }) + 1;
        const resetRequests24h = await RecoveryAuditLog.count({
          where: {
            userId: user.id, event: "reset_requested",
            createdAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60_000) },
          },
          transaction: tx,
        });
        const values = {
          status: "pending" as const,
          expiresAt: new Date(Date.now() + 48 * 60 * 60_000),
          ipAddress: context.ipAddress, userAgent: context.userAgent,
          recurrenceCount, riskFlag: resetRequests24h >= 3 || recurrenceCount >= 3,
          elevated: user.isProtected || user.role === "admin" || user.role === "super_admin",
          resolvedBy: null, resolvedAt: null, rejectionReason: null,
        };
        const pending = existing && existing.status === "pending"
          ? await existing.update(values, { transaction: tx })
          : await RecoveryRequest.create({ userId: user.id, ...values }, { transaction: tx });
        await auditRecovery("reset_completed", user.id, context, {
          requestId: pending.id, actorId: user.id, transaction: tx,
        });
        return {
          ok: true, email: user.email, elevated: values.elevated,
          newCase: !(existing && existing.status === "pending"), requestId: pending.id,
        } as const;
      });
      if ("error" in outcome) { res.status(outcome.status).json({ error: outcome.error }); return; }
      if (outcome.newCase) {
        void notifyRecoveryAdmins(
          "Account recovery approval required",
          outcome.elevated
            ? "A protected or elevated account recovery is awaiting Super Admin approval."
            : `A password reset was completed and is awaiting approval for ${outcome.email}.`,
          outcome.elevated,
        );
      }
      res.json({ message: "Password reset successfully. Please sign in." });
    } catch { res.status(400).json({ error: GENERIC_COMPLETE }); }
  }
}