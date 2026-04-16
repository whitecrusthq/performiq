import bcrypt from "bcryptjs";
import { User, CustomRole } from "../models/index.js";
import { generateToken } from "../middlewares/auth.js";
import { sendOtpEmail } from "../lib/mailgun.js";
import { generateOtp, storeOtp, verifyOtp } from "../lib/otp-store.js";
import SecurityController from "./SecurityController.js";

const OTP_ENABLED = !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);

function formatAuthUser(user: User, customRole?: CustomRole | null) {
  return {
    id: user.id, name: user.name, email: user.email, role: user.role,
    managerId: user.managerId, siteId: user.siteId, department: user.department,
    jobTitle: user.jobTitle, phone: user.phone, staffId: user.staffId, createdAt: user.createdAt,
    customRoleId: user.customRoleId ?? null,
    customRole: customRole ? {
      id: customRole.id,
      name: customRole.name,
      permissionLevel: customRole.permissionLevel,
      menuPermissions: (() => { try { return JSON.parse(customRole.menuPermissions ?? "[]"); } catch { return []; } })(),
    } : null,
  };
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
