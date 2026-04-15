import { Router } from "express";
import { db, appSettingsTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

async function getAppSettings() {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, 1)).limit(1);
  if (row) return row;
  const [inserted] = await db.insert(appSettingsTable).values({ id: 1 }).returning();
  return inserted;
}

router.get("/app-settings", async (_req, res) => {
  try {
    const settings = await getAppSettings();
    res.json(settings);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/app-settings", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { companyName, logoLetter, primaryHsl, themeName, loginHeadline, loginSubtext, loginBgFrom, loginBgTo } = req.body;
    const updates: Partial<typeof appSettingsTable.$inferInsert> = { updatedAt: new Date() };
    if (typeof companyName === "string" && companyName.trim()) updates.companyName = companyName.trim().slice(0, 60);
    if (typeof logoLetter === "string" && logoLetter.trim()) updates.logoLetter = logoLetter.trim().slice(0, 3);
    if (typeof primaryHsl === "string") updates.primaryHsl = primaryHsl;
    if (typeof themeName === "string") updates.themeName = themeName;
    if (typeof loginHeadline === "string") updates.loginHeadline = loginHeadline.slice(0, 200);
    if (typeof loginSubtext === "string") updates.loginSubtext = loginSubtext.slice(0, 400);
    if (typeof loginBgFrom === "string") updates.loginBgFrom = loginBgFrom;
    if (typeof loginBgTo === "string") updates.loginBgTo = loginBgTo;
    const [updated] = await db.update(appSettingsTable).set(updates).where(eq(appSettingsTable.id, 1)).returning();
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
