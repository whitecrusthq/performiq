import { Router } from "express";
import { db, usersTable, sitesTable } from "../db/index.js";
import { eq, isNotNull, ne } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/anniversaries", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      department: usersTable.department,
      jobTitle: usersTable.jobTitle,
      startDate: usersTable.startDate,
      profilePhoto: usersTable.profilePhoto,
      siteId: usersTable.siteId,
    }).from(usersTable).where(isNotNull(usersTable.startDate));

    const sites = await db.select().from(sitesTable);
    const siteMap: Record<number, string> = {};
    sites.forEach(s => { siteMap[s.id] = s.name; });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = users.map(u => {
      const start = new Date(u.startDate!);
      start.setHours(0, 0, 0, 0);

      const yearsOfService = Math.floor((today.getTime() - start.getTime()) / (365.25 * 86400000));

      const nextAnniversary = new Date(start);
      nextAnniversary.setFullYear(today.getFullYear());
      if (nextAnniversary < today) {
        nextAnniversary.setFullYear(today.getFullYear() + 1);
      }
      const daysUntilAnniversary = Math.ceil((nextAnniversary.getTime() - today.getTime()) / 86400000);

      const sameDay = nextAnniversary.getMonth() === today.getMonth() && nextAnniversary.getDate() === today.getDate();

      return {
        id: u.id,
        name: u.name,
        department: u.department,
        jobTitle: u.jobTitle,
        startDate: u.startDate,
        profilePhoto: u.profilePhoto,
        site: u.siteId ? siteMap[u.siteId] ?? null : null,
        yearsOfService,
        nextAnniversary: nextAnniversary.toISOString().split("T")[0],
        daysUntilAnniversary: sameDay ? 0 : daysUntilAnniversary,
        isToday: sameDay,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
