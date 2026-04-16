import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, customRolesTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { requireAuth, generateToken, AuthRequest } from "../middlewares/auth";
import { sendOtpEmail } from "../lib/mailgun.js";
import { generateOtp, storeOtp, verifyOtp } from "../lib/otp-store.js";
import { getSettings } from "./security.js";

const router = Router();

const OTP_ENABLED = !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);

const formatAuthUser = (user: typeof usersTable.$inferSelect, customRole?: typeof customRolesTable.$inferSelect | null) => ({
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
});

async function getCustomRole(user: typeof usersTable.$inferSelect) {
  if (!user.customRoleId) return null;
  const [cr] = await db.select().from(customRolesTable).where(eq(customRolesTable.id, user.customRoleId)).limit(1);
  return cr ?? null;
}

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }

    const settings = await getSettings();

    if (settings.lockoutEnabled && user.isLocked) {
      const lockedAt = user.lockedAt ? new Date(user.lockedAt).getTime() : 0;
      const unlockAt = lockedAt + settings.lockoutDurationMinutes * 60 * 1000;
      if (Date.now() < unlockAt) {
        const minsLeft = Math.ceil((unlockAt - Date.now()) / 60000);
        res.status(403).json({ error: `Account is locked. Try again in ${minsLeft} minute${minsLeft === 1 ? "" : "s"} or contact your administrator.` });
        return;
      }
      await db.update(usersTable).set({ isLocked: false, failedLoginAttempts: 0, lockedAt: null }).where(eq(usersTable.id, user.id));
      user.isLocked = false;
      user.failedLoginAttempts = 0;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      if (settings.lockoutEnabled) {
        const newAttempts = user.failedLoginAttempts + 1;
        const shouldLock = newAttempts >= settings.maxAttempts;
        await db.update(usersTable).set({
          failedLoginAttempts: newAttempts,
          isLocked: shouldLock,
          lockedAt: shouldLock ? new Date() : user.lockedAt,
        }).where(eq(usersTable.id, user.id));
        if (shouldLock) {
          res.status(403).json({ error: `Account locked after ${settings.maxAttempts} failed attempts. Contact your administrator to unlock.` });
          return;
        }
        const remaining = settings.maxAttempts - newAttempts;
        res.status(401).json({ error: `Invalid credentials. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.` });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
      return;
    }

    await db.update(usersTable).set({ failedLoginAttempts: 0, isLocked: false, lockedAt: null }).where(eq(usersTable.id, user.id));

    if (OTP_ENABLED) {
      const otp = generateOtp();
      storeOtp(email, otp);
      try {
        await sendOtpEmail(email, otp, user.name);
        res.json({ status: "otp_required", message: "A verification code has been sent to your email." });
      } catch (mailErr) {
        console.error("Mailgun error:", mailErr);
        res.status(500).json({ error: "Failed to send verification code. Please try again." });
      }
      return;
    }

    const customRole = await getCustomRole(user);
    const token = generateToken({ id: user.id, role: user.role, email: user.email, customRoleName: customRole?.name ?? null });
    res.json({ token, user: formatAuthUser(user, customRole) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ error: "Email and OTP are required" });
      return;
    }
    const result = verifyOtp(email, otp);
    if (result === "expired") {
      res.status(401).json({ error: "Verification code has expired. Please sign in again." });
      return;
    }
    if (result === "too_many_attempts") {
      res.status(429).json({ error: "Too many failed attempts. Please sign in again." });
      return;
    }
    if (result !== "valid") {
      res.status(401).json({ error: "Invalid verification code." });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const customRole = await getCustomRole(user);
    const token = generateToken({ id: user.id, role: user.role, email: user.email, customRoleName: customRole?.name ?? null });
    res.json({ token, user: formatAuthUser(user, customRole) });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

router.post("/auth/change-password", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current and new password are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, req.user!.id));
    res.json({ message: "Password updated successfully" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const customRole = await getCustomRole(user);
    res.json(formatAuthUser(user, customRole));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
