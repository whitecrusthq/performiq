import bcrypt from "bcryptjs";
import { Request } from "express";
import sequelize from "../db/sequelize.js";
import { User, CustomRole, Site, RecoveryRequest } from "../models/index.js";
import { generateToken, generate2FAPendingToken, generateTermsPendingToken, generateTemporaryPasswordPendingToken, generateRecoveryPendingToken } from "../middlewares/auth.js";
import { sendOtpEmail } from "../lib/mailgun.js";
import { generateOtp, storeOtp, verifyOtp } from "../lib/otp-store.js";
import { verifyToken as verifyTotpToken, consumeBackupCode } from "../lib/totp.js";
import SecurityController from "./SecurityController.js";
import LegalController from "./LegalController.js";
import { auditRecovery, expirePending, recoveryContext } from "../lib/account-recovery.js";
import { sendAdministrativeNotification } from "../lib/administrative-notifications.js";

// Email login codes require configured Mailgun API or SMTP credentials and explicit opt-in,
// so that merely configuring email notifications never locks users out of login.
const OTP_ENABLED = process.env.LOGIN_OTP_ENABLED === "true"
  && !!(
    (process.env.MAILGUN_SMTP_USERNAME && process.env.MAILGUN_SMTP_PASSWORD)
    || (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN)
  );

function formatAuthUser(user: User, customRole?: CustomRole | null) {
  return {
    id: user.id, name: user.name, email: user.email, role: user.role,
    managerId: user.managerId, siteId: user.siteId, department: user.department,
    jobTitle: user.jobTitle, phone: user.phone, staffId: user.staffId, createdAt: user.createdAt,
    gradeId: user.gradeId ?? null, startDate: user.startDate ?? null,
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

/**
 * Final step shared by every login path (password / OTP / 2FA). Runs the Terms &
 * Conditions acceptance gate as the very last check before a session token is
 * issued: if the user hasn't accepted the current published terms version, no
 * session is granted — instead a short-lived "terms-accept" pending token is
 * returned and the frontend shows the acceptance step.
 */
async function finalizeLogin(user: User, req?: Request) {
  const context = req ? recoveryContext(req) : { ipAddress: null, userAgent: null };
  const gate = await LegalController.getTermsGateState(user.id);
  // Password-reset completion locks the User row before its recovery row. Keep
  // that same order here so this check, token-version rotation, and JWT minting
  // serialize with reset completion. Consequently a JWT issued just before a
  // reset is invalidated by that reset, and one issued after it observes pending.
  return sequelize.transaction(async transaction => {
    const lockedUser = await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!lockedUser || lockedUser.isActive === false) {
      return { error: "This account has been deactivated. Please contact your administrator.", status: 403 } as const;
    }
    const latest = await RecoveryRequest.findOne({
      where: { userId: lockedUser.id }, order: [["createdAt", "DESC"], ["id", "DESC"]],
      transaction, lock: transaction.LOCK.UPDATE,
    });
    if (latest) {
      await expirePending(latest, context, transaction);
      if (latest.status === "pending") {
        await auditRecovery("pending_login", lockedUser.id, context, {
          requestId: latest.id, actorId: lockedUser.id, transaction,
        });
        return {
          recoveryPending: true as const,
          pendingToken: generateRecoveryPendingToken({
            id: lockedUser.id, requestId: latest.id, tokenVersion: lockedUser.tokenVersion,
          }),
          expiresAt: latest.expiresAt,
        };
      }
      if (latest.status === "rejected" || latest.status === "expired") {
        return {
          error: "A new password reset is required before you can sign in.",
          status: 403,
          recoveryResetRequired: true as const,
        };
      }
    }
    if (gate.required) {
      const pendingToken = generateTermsPendingToken({
        id: lockedUser.id, email: lockedUser.email, version: gate.version, tokenVersion: lockedUser.tokenVersion,
      });
      return { requiresTermsAcceptance: true as const, pendingToken, termsVersion: gate.version };
    }
    const customRole = lockedUser.customRoleId
      ? await CustomRole.findByPk(lockedUser.customRoleId, { transaction })
      : null;
    const tokenVersion = lockedUser.tokenVersion + 1;
    await lockedUser.update({ tokenVersion }, { transaction });
    const token = generateToken({
      id: lockedUser.id, role: lockedUser.role, email: lockedUser.email,
      customRoleName: customRole?.name ?? null, tokenVersion,
    });
    return { token, user: formatAuthUser(lockedUser, customRole) };
  });
}

export default class AuthController {
  static async login(email: string, password: string, req?: Request) {
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) return { error: "Invalid credentials", status: 401 };

    if (user.isActive === false) {
      return { error: "This account has been deactivated. Please contact your administrator.", status: 403 };
    }

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
          void sendAdministrativeNotification({
            subject: "PerformIQ account locked",
            text: `${user.name}'s account (${user.email}) was locked after ${settings.maxAttempts} failed sign-in attempts.`,
          });
          return { error: `Account locked after ${settings.maxAttempts} failed attempts. Contact your administrator to unlock.`, status: 403 };
        }
        const remaining = settings.maxAttempts - newAttempts;
        return { error: `Invalid credentials. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`, status: 401 };
      }
      return { error: "Invalid credentials", status: 401 };
    }

    await User.update({ failedLoginAttempts: 0, isLocked: false, lockedAt: null }, { where: { id: user.id } });

    if (user.mustChangePassword) {
      return {
        requiresPasswordChange: true as const,
        pendingToken: generateTemporaryPasswordPendingToken({
          id: user.id,
          email: user.email,
          tokenVersion: user.tokenVersion,
        }),
      };
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const pendingToken = generate2FAPendingToken({ id: user.id, email: user.email, purpose: "2fa-verify", tokenVersion: user.tokenVersion });
      return { requires2FA: true, pendingToken, email: user.email };
    }

    if (await is2FAEnforcedForUser(user, settings)) {
      const pendingToken = generate2FAPendingToken({ id: user.id, email: user.email, purpose: "2fa-setup", tokenVersion: user.tokenVersion });
      return { requires2FASetup: true, pendingToken, email: user.email };
    }

    if (OTP_ENABLED) {
      const otp = generateOtp();
      storeOtp(email, otp, user.tokenVersion);
      try {
        await sendOtpEmail(email, otp, user.name);
        return { otpRequired: true };
      } catch (mailErr) {
        console.error("Mailgun error:", mailErr);
        return { error: "Failed to send verification code. Please try again.", status: 500 };
      }
    }

    return finalizeLogin(user, req);
  }

  static async verifyOtp(email: string, otp: string, req?: Request) {
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) return { error: "User not found", status: 404 };
    const result = verifyOtp(email, otp, user.tokenVersion);
    if (result === "expired") return { error: "Verification code has expired. Please sign in again.", status: 401 };
    if (result === "too_many_attempts") return { error: "Too many failed attempts. Please sign in again.", status: 429 };
    if (result !== "valid") return { error: "Invalid verification code.", status: 401 };

    if (user.isActive === false) {
      return { error: "This account has been deactivated. Please contact your administrator.", status: 403 };
    }
    return finalizeLogin(user, req);
  }

  static async verify2FA(userId: number, code: string, req?: Request, expectedTokenVersion?: number) {
    const user = await User.findByPk(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return { error: "Two-factor authentication is not enabled for this account.", status: 400 };
    }
    if (user.isActive === false) {
      return { error: "This account has been deactivated. Please contact your administrator.", status: 403 };
    }
    if (expectedTokenVersion !== undefined && user.tokenVersion !== expectedTokenVersion) {
      return { error: "Verification session expired. Please sign in again.", status: 401 };
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

    return finalizeLogin(user, req);
  }

  /**
   * Records acceptance of the current terms for a user identified by a valid
   * "terms-accept" pending token, then issues the real session token. Re-checks
   * active state so a user deactivated mid-flow cannot complete login.
   */
  static async acceptTerms(userId: number, acceptedVersion: number, ip: string | null, req?: Request, expectedTokenVersion?: number) {
    const user = await User.findByPk(userId);
    if (!user) return { error: "User not found", status: 404 };
    if (user.isActive === false) {
      return { error: "This account has been deactivated. Please contact your administrator.", status: 403 };
    }
    if (expectedTokenVersion !== undefined && user.tokenVersion !== expectedTokenVersion) {
      return { error: "Your session expired. Please sign in again.", status: 401 };
    }
    // Compare against the current server-side version (never trust the client).
    const gate = await LegalController.getTermsGateState(userId);
    // If terms were re-published between prompt and submit, the user is confirming
    // an outdated version they never saw — refuse and re-prompt with the new one.
    if (gate.required && gate.version !== acceptedVersion) {
      const pendingToken = generateTermsPendingToken({ id: user.id, email: user.email, version: gate.version, tokenVersion: user.tokenVersion });
      return { requiresTermsAcceptance: true as const, pendingToken, termsVersion: gate.version };
    }
    if (gate.required && gate.version >= 1) {
      await LegalController.recordAcceptance(userId, gate.version, ip);
    }
    return finalizeLogin(user, req);
  }

  /**
   * Public wrapper around the shared login finalizer so non-standard entry points
   * (e.g. forced 2FA setup) run the same Terms & Conditions gate before issuing a
   * session, instead of minting a JWT directly and bypassing compliance.
   */
  static async finalize(user: User, req?: Request) {
    return finalizeLogin(user, req);
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

  static async changeTemporaryPassword(userId: number, email: string, tokenVersion: number, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    return sequelize.transaction(async transaction => {
      const user = await User.findByPk(userId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (
        !user
        || user.email !== email
        || user.tokenVersion !== tokenVersion
        || !user.mustChangePassword
      ) return { error: "Invalid or expired temporary password request", status: 401 };
      await user.update({
        passwordHash,
        mustChangePassword: false,
        tokenVersion: sequelize.literal("token_version + 1") as any,
      }, { transaction });
      return { message: "Password changed. Please sign in with your new password." };
    });
  }

  static async getMe(userId: number) {
    const user = await User.findByPk(userId);
    if (!user) return null;
    const customRole = await getCustomRole(user);
    return formatAuthUser(user, customRole);
  }
}
