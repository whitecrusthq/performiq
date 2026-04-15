import { Router } from "express";
import { db, hrQueriesTable, hrQueryMessagesTable, usersTable } from "../db/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { eq, desc, asc } from "drizzle-orm";

const router = Router();

// Helper to enrich a query row with user info
async function enrichQuery(q: any) {
  const [submitter] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, q.userId));

  let assignee = null;
  if (q.assignedTo) {
    const [a] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, q.assignedTo));
    assignee = a ?? null;
  }

  let responder = null;
  if (q.respondedBy) {
    const [r] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, q.respondedBy));
    responder = r ?? null;
  }

  return { ...q, submitter: submitter ?? null, assignee, responder };
}

// GET /api/hr-queries — HR/admin sees all; employee sees own
router.get("/hr-queries", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const isHR = ["super_admin", "admin"].includes(user.role) ||
      (user as any).customRole?.name?.toLowerCase() === "hr manager";

    const rows = isHR
      ? await db.select().from(hrQueriesTable).orderBy(desc(hrQueriesTable.createdAt))
      : await db.select().from(hrQueriesTable)
          .where(eq(hrQueriesTable.userId, user.id))
          .orderBy(desc(hrQueriesTable.createdAt));

    const enriched = await Promise.all(rows.map(enrichQuery));
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch queries" });
  }
});

// GET /api/hr-queries/:id
router.get("/hr-queries/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id);
    const [q] = await db.select().from(hrQueriesTable).where(eq(hrQueriesTable.id, id));
    if (!q) return res.status(404).json({ error: "Not found" });
    const isHR = ["super_admin", "admin"].includes(user.role) ||
      (user as any).customRole?.name?.toLowerCase() === "hr manager";
    if (!isHR && q.userId !== user.id) return res.status(403).json({ error: "Forbidden" });
    res.json(await enrichQuery(q));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch query" });
  }
});

// POST /api/hr-queries — any authenticated user can submit
router.post("/hr-queries", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { title, description, category = "general", priority = "normal" } = req.body;
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ error: "Title and description are required" });
    }
    const [q] = await db.insert(hrQueriesTable).values({
      userId: user.id,
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
    }).returning();
    res.status(201).json(await enrichQuery(q));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit query" });
  }
});

// PUT /api/hr-queries/:id — HR updates status/response; submitter can update own open queries
router.put("/hr-queries/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id);
    const [q] = await db.select().from(hrQueriesTable).where(eq(hrQueriesTable.id, id));
    if (!q) return res.status(404).json({ error: "Not found" });

    const isHR = ["super_admin", "admin"].includes(user.role) ||
      (user as any).customRole?.name?.toLowerCase() === "hr manager";
    const isOwner = q.userId === user.id;

    if (!isHR && !isOwner) return res.status(403).json({ error: "Forbidden" });

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (isHR) {
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.priority !== undefined) updates.priority = req.body.priority;
      if (req.body.assignedTo !== undefined) updates.assignedTo = req.body.assignedTo || null;
      if (req.body.response !== undefined) {
        updates.response = req.body.response;
        updates.respondedBy = user.id;
        updates.respondedAt = new Date();
      }
    }

    // Owner can update title/desc/category/priority while still open
    if (isOwner && q.status === "open") {
      if (req.body.title !== undefined) updates.title = req.body.title.trim();
      if (req.body.description !== undefined) updates.description = req.body.description.trim();
      if (req.body.category !== undefined) updates.category = req.body.category;
      if (req.body.priority !== undefined) updates.priority = req.body.priority;
    }

    const [updated] = await db.update(hrQueriesTable).set(updates).where(eq(hrQueriesTable.id, id)).returning();
    res.json(await enrichQuery(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update query" });
  }
});

// GET /api/hr-queries/:id/messages
router.get("/hr-queries/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id);
    const [q] = await db.select().from(hrQueriesTable).where(eq(hrQueriesTable.id, id)).limit(1);
    if (!q) return res.status(404).json({ error: "Not found" });
    const isHR = ["super_admin", "admin"].includes(user.role) || (user as any).customRole?.name?.toLowerCase() === "hr manager";
    if (!isHR && q.userId !== user.id) return res.status(403).json({ error: "Forbidden" });

    const msgs = await db
      .select({
        id: hrQueryMessagesTable.id,
        queryId: hrQueryMessagesTable.queryId,
        senderId: hrQueryMessagesTable.senderId,
        body: hrQueryMessagesTable.body,
        createdAt: hrQueryMessagesTable.createdAt,
        senderName: usersTable.name,
        senderRole: usersTable.role,
      })
      .from(hrQueryMessagesTable)
      .leftJoin(usersTable, eq(hrQueryMessagesTable.senderId, usersTable.id))
      .where(eq(hrQueryMessagesTable.queryId, id))
      .orderBy(asc(hrQueryMessagesTable.createdAt));

    res.json(msgs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/hr-queries/:id/messages
router.post("/hr-queries/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id);
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: "Message body required" });

    const [q] = await db.select().from(hrQueriesTable).where(eq(hrQueriesTable.id, id)).limit(1);
    if (!q) return res.status(404).json({ error: "Not found" });
    const isHR = ["super_admin", "admin"].includes(user.role) || (user as any).customRole?.name?.toLowerCase() === "hr manager";
    if (!isHR && q.userId !== user.id) return res.status(403).json({ error: "Forbidden" });
    if (q.status === "closed") return res.status(400).json({ error: "Query is closed" });

    const [msg] = await db.insert(hrQueryMessagesTable).values({
      queryId: id,
      senderId: user.id,
      body: body.trim(),
    }).returning();

    // If HR sends a message, mark query in_progress / update respondedBy
    if (isHR && q.status === "open") {
      await db.update(hrQueriesTable).set({
        status: "in_progress",
        respondedBy: user.id,
        respondedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(hrQueriesTable.id, id));
    } else {
      await db.update(hrQueriesTable).set({ updatedAt: new Date() }).where(eq(hrQueriesTable.id, id));
    }

    res.status(201).json({ ...msg, senderName: user.name, senderRole: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/hr-queries/:id — HR or owner (if open)
router.delete("/hr-queries/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id);
    const [q] = await db.select().from(hrQueriesTable).where(eq(hrQueriesTable.id, id));
    if (!q) return res.status(404).json({ error: "Not found" });

    const isHR = ["super_admin", "admin"].includes(user.role) ||
      (user as any).customRole?.name?.toLowerCase() === "hr manager";
    const isOwner = q.userId === user.id && q.status === "open";

    if (!isHR && !isOwner) return res.status(403).json({ error: "Forbidden" });

    await db.delete(hrQueriesTable).where(eq(hrQueriesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete query" });
  }
});

export default router;
