import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { User, sequelize } from "../../models/index.js";
import { sendPasswordResetCodeEmail } from "../../lib/mailgun.js";

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
      const delivery = await sequelize.transaction(async tx => {
        const user = await User.findOne({ where: { email }, transaction: tx, lock: tx.LOCK.UPDATE });
        if (!user || user.isActive === false
          || (user.passwordResetRequestedAt && now - new Date(user.passwordResetRequestedAt).getTime() < 60_000)) return null;
        const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
        await User.update({
          passwordResetCodeHash: codeHash(code), passwordResetExpiresAt: new Date(now + 10 * 60_000),
          passwordResetAttempts: 0, passwordResetRequestedAt: new Date(now),
        }, { where: { id: user.id }, transaction: tx });
        return { email: user.email, name: user.name, code };
      });
      if (delivery) void sendPasswordResetCodeEmail(delivery.email, delivery.code, delivery.name).catch(() => undefined);
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
        return { ok: true } as const;
      });
      if ("error" in outcome) { res.status(outcome.status).json({ error: outcome.error }); return; }
      res.json({ message: "Password reset successfully. Please sign in." });
    } catch { res.status(400).json({ error: GENERIC_COMPLETE }); }
  }
}