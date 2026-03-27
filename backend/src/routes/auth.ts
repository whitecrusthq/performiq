import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { requireAuth, generateToken, AuthRequest } from "../middlewares/auth";
import { sendOtpEmail } from "../lib/mailgun.js";
import { generateOtp, storeOtp, verifyOtp } from "../lib/otp-store.js";

const router = Router();

const OTP_ENABLED = !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);

const formatAuthUser = (user: typeof usersTable.$inferSelect) => ({
  id: user.id, name: user.name, email: user.email, role: user.role,
  managerId: user.managerId, siteId: user.siteId, department: user.department,
  jobTitle: user.jobTitle, phone: user.phone, staffId: user.staffId, createdAt: user.createdAt,
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }

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

    const token = generateToken({ id: user.id, role: user.role, email: user.email });
    res.json({ token, user: formatAuthUser(user) });
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
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const token = generateToken({ id: user.id, role: user.role, email: user.email });
    res.json({ token, user: formatAuthUser(user) });
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
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      managerId: user.managerId,
      department: user.department,
      jobTitle: user.jobTitle,
      createdAt: user.createdAt,
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
