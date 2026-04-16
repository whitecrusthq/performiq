import { Router } from "express";
import { db, usersTable, sitesTable, staffRemindersTable } from "../db/index.js";
import { eq, isNotNull, ne, and } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";

const router = Router();

function computeDateInfo(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);

  const years = Math.floor((today.getTime() - d.getTime()) / (365.25 * 86400000));

  const nextDate = new Date(d);
  nextDate.setFullYear(today.getFullYear());
  if (nextDate < today) {
    nextDate.setFullYear(today.getFullYear() + 1);
  }
  const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / 86400000);
  const sameDay = nextDate.getMonth() === today.getMonth() && nextDate.getDate() === today.getDate();

  return {
    years,
    nextDate: nextDate.toISOString().split("T")[0],
    daysUntil: sameDay ? 0 : daysUntil,
    isToday: sameDay,
  };
}

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

    const enriched = users.map(u => {
      const info = computeDateInfo(u.startDate!);
      return {
        id: u.id,
        name: u.name,
        department: u.department,
        jobTitle: u.jobTitle,
        startDate: u.startDate,
        profilePhoto: u.profilePhoto,
        site: u.siteId ? siteMap[u.siteId] ?? null : null,
        yearsOfService: info.years,
        nextAnniversary: info.nextDate,
        daysUntilAnniversary: info.daysUntil,
        isToday: info.isToday,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/birthdays", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      department: usersTable.department,
      jobTitle: usersTable.jobTitle,
      dateOfBirth: usersTable.dateOfBirth,
      profilePhoto: usersTable.profilePhoto,
      siteId: usersTable.siteId,
    }).from(usersTable).where(isNotNull(usersTable.dateOfBirth));

    const sites = await db.select().from(sitesTable);
    const siteMap: Record<number, string> = {};
    sites.forEach(s => { siteMap[s.id] = s.name; });

    const enriched = users.map(u => {
      const info = computeDateInfo(u.dateOfBirth!);
      return {
        id: u.id,
        name: u.name,
        department: u.department,
        jobTitle: u.jobTitle,
        dateOfBirth: u.dateOfBirth,
        profilePhoto: u.profilePhoto,
        site: u.siteId ? siteMap[u.siteId] ?? null : null,
        age: info.years,
        turningAge: info.years + (info.isToday ? 0 : 1),
        nextBirthday: info.nextDate,
        daysUntilBirthday: info.daysUntil,
        isToday: info.isToday,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/weddings", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      department: usersTable.department,
      jobTitle: usersTable.jobTitle,
      weddingDate: usersTable.weddingDate,
      spouseName: usersTable.spouseName,
      profilePhoto: usersTable.profilePhoto,
      siteId: usersTable.siteId,
    }).from(usersTable).where(isNotNull(usersTable.weddingDate));

    const sites = await db.select().from(sitesTable);
    const siteMap: Record<number, string> = {};
    sites.forEach(s => { siteMap[s.id] = s.name; });

    const enriched = users.map(u => {
      const info = computeDateInfo(u.weddingDate!);
      return {
        id: u.id,
        name: u.name,
        department: u.department,
        jobTitle: u.jobTitle,
        weddingDate: u.weddingDate,
        spouseName: u.spouseName,
        profilePhoto: u.profilePhoto,
        site: u.siteId ? siteMap[u.siteId] ?? null : null,
        yearsMarried: info.years,
        nextAnniversary: info.nextDate,
        daysUntilAnniversary: info.daysUntil,
        isToday: info.isToday,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/reminders", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const reminders = await db.select().from(staffRemindersTable);

    const userIds = [...new Set(reminders.filter(r => r.userId).map(r => r.userId!))];
    let userMap: Record<number, { name: string; department: string | null; jobTitle: string | null; profilePhoto: string | null }> = {};
    if (userIds.length > 0) {
      const users = await db.select({
        id: usersTable.id,
        name: usersTable.name,
        department: usersTable.department,
        jobTitle: usersTable.jobTitle,
        profilePhoto: usersTable.profilePhoto,
      }).from(usersTable);
      users.forEach(u => { userMap[u.id] = u; });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = reminders.map(r => {
      const rDate = new Date(r.reminderDate);
      rDate.setHours(0, 0, 0, 0);

      let nextDate: Date;
      let daysUntil: number;
      let isToday = false;

      if (r.recurring) {
        nextDate = new Date(rDate);
        nextDate.setFullYear(today.getFullYear());
        if (nextDate < today) {
          nextDate.setFullYear(today.getFullYear() + 1);
        }
        const sameDay = nextDate.getMonth() === today.getMonth() && nextDate.getDate() === today.getDate();
        daysUntil = sameDay ? 0 : Math.ceil((nextDate.getTime() - today.getTime()) / 86400000);
        isToday = sameDay;
      } else {
        nextDate = rDate;
        const sameDay = rDate.getMonth() === today.getMonth() && rDate.getDate() === today.getDate() && rDate.getFullYear() === today.getFullYear();
        daysUntil = sameDay ? 0 : Math.ceil((rDate.getTime() - today.getTime()) / 86400000);
        isToday = sameDay;
      }

      const user = r.userId ? userMap[r.userId] : null;

      return {
        id: r.id,
        title: r.title,
        reminderType: r.reminderType,
        reminderDate: r.reminderDate,
        recurring: r.recurring,
        notes: r.notes,
        userId: r.userId,
        userName: user?.name ?? null,
        userDepartment: user?.department ?? null,
        userJobTitle: user?.jobTitle ?? null,
        userProfilePhoto: user?.profilePhoto ?? null,
        nextDate: nextDate.toISOString().split("T")[0],
        daysUntil,
        isToday,
        isPast: !r.recurring && daysUntil < 0,
      };
    });

    res.json(enriched.filter(r => !r.isPast).sort((a, b) => a.daysUntil - b.daysUntil));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/reminders", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const { title, reminderType, reminderDate, recurring, notes, userId } = req.body;
    if (!title || !reminderDate) {
      return res.status(400).json({ error: "Title and date are required" });
    }
    const [reminder] = await db.insert(staffRemindersTable).values({
      title,
      reminderType: reminderType || "other",
      reminderDate,
      recurring: recurring !== false,
      notes: notes || null,
      userId: userId || null,
      createdById: req.user!.id,
    }).returning();

    res.status(201).json(reminder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/reminders/:id", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const { title, reminderType, reminderDate, recurring, notes, userId } = req.body;
    const [updated] = await db.update(staffRemindersTable).set({
      title,
      reminderType: reminderType || "other",
      reminderDate,
      recurring: recurring !== false,
      notes: notes || null,
      userId: userId || null,
    }).where(eq(staffRemindersTable.id, Number(req.params.id))).returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/reminders/:id", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const [deleted] = await db.delete(staffRemindersTable).where(eq(staffRemindersTable.id, Number(req.params.id))).returning();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
