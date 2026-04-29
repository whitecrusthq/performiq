import bcrypt from "bcryptjs";
import { User, CustomRole, Site } from "../models/index.js";
import { generateToken, generate2FAPendingToken } from "../middlewares/auth.js";
import { sendOtpEmail } from "../lib/mailgun.js";
import { generateOtp, storeOtp, verifyOtp } from "../lib/otp-store.js";
import { verifyToken as verifyTotpToken, consumeBackupCode } from "../lib/totp.js";
import SecurityController from "./SecurityController.js";

const OTP_ENABLED = !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);

function formatAuthUser(user: User, customRole?: CustomRole | null) {
  return {
    id: user.id, name: user.name, email: user.email, role: user.role,
    managerId: user.managerId, siteId: user.siteId, department: user.department,
    jobTitle: user.jobTitle, phone: user.phone, staffId: user.staffId, createdAt: user.createdAt,
    twoFactorEnabled: !!user.twoFactorEnabled,
    customRoleId: user.customRoleId ?? null,
    customRole: customRole ? {
      id: customRole.id,
      name: customRole.name,
      permissionLevel: customRole.permissionLevel,
      menuPermissions: (() => { try { return JSON.parse(customRole.menuPermissions ?? "[]"); } catch { return []; } })(),
    } : null,
  };
}

async function is2FAEnforcedForUser(user: User, settings: { enforce2faAll: boolean; enforce2faRoles: string | null }): Promise<boolean> {
  if (settings.enforce2faAll) return true;
  if (user.require2Fa) return true;
  if (user.siteId) {
    const site = await Site.findByPk(user.siteId);
    if (site && site.require2Fa) return true;
  }
  if (settings.enforce2faRoles) {
    try {
      const roles: string[] = JSON.parse(settings.enforce2faRoles);
      if (Array.isArray(roles) && roles.includes(user.role)) return true;
    } catch {}
  }
  return false;
}

async function getCustomRole(user: User) {
  if (!user.customRoleId) return null;
  const cr = await CustomRole.findByPk(user.customRoleId);
  return cr ?? null;
}

export default class AuthController {
  static async login(email: string, password: string) {
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) return { error: "Invalid credentials", status: 401 };

    const settings = await SecurityController.getSettings();

    if (settings.lockoutEnabled && user.isLocked) {
      const lockedAt = user.lockedAt ? new Date(user.lockedAt).getTime() : 0;
      const unlockAt = lockedAt + settings.lockoutDurationMinutes * 60 * 1000;
      if (Date.now() < unlockAt) {
        const minsLeft = Math.ceil((unlockAt - Date.now()) / 60000);
        return { error: `Account is locked. Try again in ${minsLeft} minute${minsLeft === 1 ? "" : "s"} or contact your administrator.`, status: 403 };
      }
      await User.update({ isLocked: false, failedLoginAttempts: 0, lockedAt: null }, { where: { id: user.id } });
      user.isLocked = false;
      user.failedLoginAttempts = 0;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      if (settings.lockoutEnabled) {
        const newAttempts = user.failedLoginAttempts + 1;
        const shouldLock = newAttempts >= settings.maxAttempts;
        await User.update({
          failedLoginAttempts: newAttempts,
          isLocked: shouldLock,
          lockedAt: shouldLock ? new Date() : user.lockedAt,
        }, { where: { id: user.id } });
        if (shouldLock) {
          return { error: `Account locked after ${settings.maxAttempts} failed attempts. Contact your administrator to unlock.`, status: 403 };
        }
        const remaining = settings.maxAttempts - newAttempts;
        return { error: `Invalid credentials. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`, status: 401 };
      }
      return { error: "Invalid credentials", status: 401 };
    }

    await User.update({ failedLoginAttempts: 0, isLocked: false, lockedAt: null }, { where: { id: user.id } });

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const pendingToken = generate2FAPendingToken({ id: user.id, email: user.email, purpose: "2fa-verify" });
      return { requires2FA: true, pendingToken, email: user.email };
    }

    if (await is2FAEnforcedForUser(user, settings)) {
      const pendingToken = generate2FAPendingToken({ id: user.id, email: user.email, purpose: "2fa-setup" });
      return { requires2FASetup: true, pendingToken, email: user.email };
    }

    if (OTP_ENABLED) {
      const otp = generateOtp();
      storeOtp(email, otp);
      try {
        await sendOtpEmail(email, otp, user.name);
        return { otpRequired: true };
      } catch (mailErr) {
        console.error("Mailgun error:", mailErr);
        return { error: "Failed to send verification code. Please try again.", status: 500 };
      }
    }

    const customRole = await getCustomRole(user);
    const token = generateToken({ id: user.id, role: user.role, email: user.email, customRoleName: customRole?.name ?? null });
    return { token, user: formatAuthUser(user, customRole) };
  }

  static async verifyOtp(email: string, otp: string) {
    const result = verifyOtp(email, otp);
    if (result === "expired") return { error: "Verification code has expired. Please sign in again.", status: 401 };
    if (result === "too_many_attempts") return { error: "Too many failed attempts. Please sign in again.", status: 429 };
    if (result !== "valid") return { error: "Invalid verification code.", status: 401 };

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) return { error: "User not found", status: 404 };
    const customRole = await getCustomRole(user);
    const token = generateToken({ id: user.id, role: user.role, email: user.email, customRoleName: customRole?.name ?? null });
    return { token, user: formatAuthUser(user, customRole) };
  }

  static async verify2FA(userId: number, code: string) {
    const user = await User.findByPk(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return { error: "Two-factor authentication is not enabled for this account.", status: 400 };
    }
    const codeStr = String(code).trim();
    const isTotpValid = /^\d{6}$/.test(codeStr) && verifyTotpToken(user.twoFactorSecret, codeStr);

    if (!isTotpValid) {
      const stored: string[] = (() => { try { return JSON.parse(user.twoFactorBackupCodes ?? "[]"); } catch { return []; } })();
      if (Array.isArray(stored) && stored.length > 0) {
        const { ok, remaining } = await consumeBackupCode(stored, codeStr);
        if (ok) {
          await User.update({ twoFactorBackupCodes: JSON.stringify(remaining) }, { where: { id: userId } });
        } else {
          return { error: "Invalid verification code.", status: 401 };
        }
      } else {
        return { error: "Invalid verification code.", status: 401 };
      }
    }

    const customRole = await getCustomRole(user);
    const token = generateToken({ id: user.id, role: user.role, email: user.email, customRoleName: customRole?.name ?? null });
    return { token, user: formatAuthUser(user, customRole) };
  }

  static async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await User.findByPk(userId);
    if (!user) return { error: "User not found", status: 404 };
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return { error: "Current password is incorrect", status: 401 };
    const newHash = await bcrypt.hash(newPassword, 10);
    await User.update({ passwordHash: newHash }, { where: { id: userId } });
    return { message: "Password updated successfully" };
  }

  static async getMe(userId: number) {
    const user = await User.findByPk(userId);
    if (!user) return null;
    const customRole = await getCustomRole(user);
    return formatAuthUser(user, customRole);
  }
}
