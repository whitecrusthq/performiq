import { Router } from "express";
import { db, transferRequestsTable, usersTable, sitesTable } from "../db/index.js";
import { eq, desc, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";

const router = Router();

async function enrichTransfer(t: typeof transferRequestsTable.$inferSelect) {
  const userIds = [t.employeeId, t.requestedById, ...(t.approvedById ? [t.approvedById] : [])];
  const users = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, department: usersTable.department, jobTitle: usersTable.jobTitle })
    .from(usersTable).where(inArray(usersTable.id, userIds));
  const userMap: Record<number, any> = {};
  users.forEach(u => { userMap[u.id] = u; });

  const siteIds = [t.toSiteId, ...(t.fromSiteId ? [t.fromSiteId] : [])];
  const sites = await db.select().from(sitesTable).where(inArray(sitesTable.id, siteIds));
  const siteMap: Record<number, any> = {};
  sites.forEach(s => { siteMap[s.id] = s; });

  return {
    ...t,
    employee: userMap[t.employeeId] ?? null,
    requestedBy: userMap[t.requestedById] ?? null,
    approvedBy: t.approvedById ? (userMap[t.approvedById] ?? null) : null,
    fromSite: t.fromSiteId ? (siteMap[t.fromSiteId] ?? null) : null,
    toSite: siteMap[t.toSiteId] ?? null,
  };
}

router.get("/transfers", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const { role, id: userId } = req.user!;
    let rows = await db.select().from(transferRequestsTable).orderBy(desc(transferRequestsTable.createdAt));

    if (role === "manager") {
      const team = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, userId));
      const teamIds = new Set([userId, ...team.map(t => t.id)]);
      rows = rows.filter(r => teamIds.has(r.employeeId) || r.requestedById === userId);
    }

    const enriched = await Promise.all(rows.map(enrichTransfer));
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/transfers/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [row] = await db.select().from(transferRequestsTable).where(eq(transferRequestsTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await enrichTransfer(row));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/transfers", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const { employeeId, fromSiteId, toSiteId, fromDepartment, toDepartment, reason, effectiveDate } = req.body;
    if (!employeeId || !toSiteId || !reason || !effectiveDate) {
      res.status(400).json({ error: "employeeId, toSiteId, reason, and effectiveDate are required" }); return;
    }

    const [row] = await db.insert(transferRequestsTable).values({
      employeeId: Number(employeeId),
      fromSiteId: fromSiteId ? Number(fromSiteId) : null,
      toSiteId: Number(toSiteId),
      fromDepartment: fromDepartment || null,
      toDepartment: toDepartment || null,
      reason,
      effectiveDate,
      requestedById: req.user!.id,
      status: "pending",
    }).returning();

    res.status(201).json(await enrichTransfer(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/transfers/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const [row] = await db.select().from(transferRequestsTable).where(eq(transferRequestsTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    const { status, approvalNotes } = req.body;

    if (status === "approved" || status === "rejected") {
      if (row.status !== "pending") { res.status(400).json({ error: "Only pending transfers can be reviewed" }); return; }

      const [updated] = await db.update(transferRequestsTable).set({
        status,
        approvedById: req.user!.id,
        approvalNotes: approvalNotes || null,
        approvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(transferRequestsTable.id, row.id)).returning();

      if (status === "approved") {
        const updateData: any = { siteId: row.toSiteId };
        if (row.toDepartment) updateData.department = row.toDepartment;
        await db.update(usersTable).set(updateData).where(eq(usersTable.id, row.employeeId));
      }

      res.json(await enrichTransfer(updated));
      return;
    }

    if (status === "cancelled") {
      if (row.status !== "pending") { res.status(400).json({ error: "Only pending transfers can be cancelled" }); return; }
      const [updated] = await db.update(transferRequestsTable).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(eq(transferRequestsTable.id, row.id)).returning();
      res.json(await enrichTransfer(updated));
      return;
    }

    res.status(400).json({ error: "Invalid status" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/transfers/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    await db.delete(transferRequestsTable).where(eq(transferRequestsTable.id, Number(req.params.id)));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
