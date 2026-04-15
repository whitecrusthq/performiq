import { Router } from "express";
import { db, usersTable, securitySettingsTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";

const router = Router();

async function getSettings() {
  const [row] = await db.select().from(securitySettingsTable).where(eq(securitySettingsTable.id, 1)).limit(1);
  if (row) return row;
  const [inserted] = await db.insert(securitySettingsTable).values({ id: 1, lockoutEnabled: true, maxAttempts: 5, lockoutDurationMinutes: 30 }).returning();
  return inserted;
}

router.get("/security/settings", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/security/settings", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { lockoutEnabled, maxAttempts, lockoutDurationMinutes } = req.body;
    const updates: Partial<typeof securitySettingsTable.$inferInsert> = { updatedAt: new Date() };
    if (typeof lockoutEnabled === "boolean") updates.lockoutEnabled = lockoutEnabled;
    if (typeof maxAttempts === "number" && maxAttempts >= 1 && maxAttempts <= 50) updates.maxAttempts = maxAttempts;
    if (typeof lockoutDurationMinutes === "number" && lockoutDurationMinutes >= 1) updates.lockoutDurationMinutes = lockoutDurationMinutes;
    const [updated] = await db.update(securitySettingsTable).set(updates).where(eq(securitySettingsTable.id, 1)).returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/security/locked-accounts", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const locked = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, lockedAt: usersTable.lockedAt, failedLoginAttempts: usersTable.failedLoginAttempts })
      .from(usersTable)
      .where(eq(usersTable.isLocked, true));
    res.json(locked);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/security/unlock/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
    const [updated] = await db
      .update(usersTable)
      .set({ isLocked: false, failedLoginAttempts: 0, lockedAt: null })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ...updated, message: "Account unlocked successfully" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export { getSettings };
export default router;
