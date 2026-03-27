import { Router } from "express";
import { db, leaveRequestsTable, usersTable } from "../db/index.js";
import { eq, or, desc, and } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";

const router = Router();

const ROLE_LEVEL: Record<string, number> = { super_admin: 4, admin: 3, manager: 2, employee: 1 };

router.get("/leave-requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id } = req.user!;
    const rows = await db.select().from(leaveRequestsTable).orderBy(desc(leaveRequestsTable.createdAt));

    let filtered = rows;
    if (role === "employee") {
      filtered = rows.filter(r => r.employeeId === id);
    } else if (role === "manager") {
      const subordinates = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, id));
      const subIds = new Set([id, ...subordinates.map(s => s.id)]);
      filtered = rows.filter(r => subIds.has(r.employeeId));
    }

    const employeeIds = [...new Set(filtered.map(r => r.employeeId))];
    const reviewerIds = [...new Set(filtered.map(r => r.reviewerId).filter(Boolean))] as number[];
    const allIds = [...new Set([...employeeIds, ...reviewerIds])];

    const users = allIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, department: usersTable.department, jobTitle: usersTable.jobTitle })
          .from(usersTable).where(or(...allIds.map(uid => eq(usersTable.id, uid))))
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const result = filtered.map(r => ({
      ...r,
      employee: userMap[r.employeeId] ?? null,
      reviewer: r.reviewerId ? (userMap[r.reviewerId] ?? null) : null,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/leave-requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { leaveType, startDate, endDate, days, reason } = req.body;
    if (!leaveType || !startDate || !endDate || !days) {
      res.status(400).json({ error: "leaveType, startDate, endDate, and days are required" });
      return;
    }
    const [row] = await db.insert(leaveRequestsTable).values({
      employeeId: req.user!.id,
      leaveType,
      startDate,
      endDate,
      days: Number(days),
      reason: reason || null,
      status: "pending",
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/leave-requests/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [row] = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const { role, id } = req.user!;
    if (role === "employee" && row.employeeId !== id) { res.status(403).json({ error: "Forbidden" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/leave-requests/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id } = req.user!;
    const [row] = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    const { status, reviewNote } = req.body;
    const level = ROLE_LEVEL[role] ?? 1;

    if (status === "cancelled") {
      if (row.employeeId !== id) { res.status(403).json({ error: "Only the applicant can cancel" }); return; }
      if (row.status !== "pending") { res.status(400).json({ error: "Only pending requests can be cancelled" }); return; }
      const [updated] = await db.update(leaveRequestsTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(leaveRequestsTable.id, row.id)).returning();
      res.json(updated);
      return;
    }

    if (status === "approved" || status === "rejected") {
      if (level < 2) { res.status(403).json({ error: "Insufficient permissions" }); return; }
      if (row.status !== "pending") { res.status(400).json({ error: "Only pending requests can be reviewed" }); return; }
      const [updated] = await db.update(leaveRequestsTable)
        .set({ status, reviewerId: id, reviewNote: reviewNote || null, updatedAt: new Date() })
        .where(eq(leaveRequestsTable.id, row.id)).returning();
      res.json(updated);
      return;
    }

    res.status(400).json({ error: "Invalid status" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/leave-requests/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.id, Number(req.params.id)));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
