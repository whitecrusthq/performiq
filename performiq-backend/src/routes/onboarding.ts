import { Router } from "express";
import { db, workflowTemplatesTable, templateTasksTable, workflowsTable, workflowTasksTable, usersTable, onboardingDocumentsTable } from "../db/index.js";
import { eq, and, asc, inArray, desc } from "drizzle-orm";
import { requireAuth, requireHRAccess, AuthRequest } from "../middlewares/auth.js";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function enrichWorkflow(wf: typeof workflowsTable.$inferSelect) {
  const [employee, startedBy] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, wf.employeeId)).limit(1),
    db.select().from(usersTable).where(eq(usersTable.id, wf.startedById)).limit(1),
  ]);
  const tasks = await db.select().from(workflowTasksTable)
    .where(eq(workflowTasksTable.workflowId, wf.id))
    .orderBy(asc(workflowTasksTable.orderIndex));

  const assigneeIds = [...new Set(tasks.map(t => t.assigneeId).filter(Boolean))] as number[];
  const assignees = assigneeIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, assigneeIds))
    : [];
  const assigneeMap = Object.fromEntries(assignees.map(u => [u.id, u]));

  const completedByIds = [...new Set(tasks.map(t => t.completedById).filter(Boolean))] as number[];
  const completedByUsers = completedByIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, completedByIds))
    : [];
  const completedByMap = Object.fromEntries(completedByUsers.map(u => [u.id, u]));

  const enrichedTasks = tasks.map(t => ({
    ...t,
    assignee: t.assigneeId ? assigneeMap[t.assigneeId] ?? null : null,
    completedBy: t.completedById ? completedByMap[t.completedById] ?? null : null,
  }));

  const total = tasks.length;
  const done = tasks.filter(t => t.status === "completed" || t.status === "skipped").length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  return {
    ...wf,
    employee: employee[0] ?? null,
    startedBy: startedBy[0] ?? null,
    tasks: enrichedTasks,
    progress,
    totalTasks: total,
    completedTasks: done,
  };
}

// ─── Templates ───────────────────────────────────────────────────────────────

// GET /api/onboarding/templates
router.get("/onboarding/templates", requireAuth, async (req, res) => {
  try {
    const templates = await db.select().from(workflowTemplatesTable)
      .orderBy(asc(workflowTemplatesTable.createdAt));
    const result = await Promise.all(templates.map(async t => {
      const tasks = await db.select().from(templateTasksTable)
        .where(eq(templateTasksTable.templateId, t.id))
        .orderBy(asc(templateTasksTable.orderIndex));
      return { ...t, tasks };
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/onboarding/templates
router.post("/onboarding/templates", requireAuth, requireHRAccess, async (req: AuthRequest, res) => {
  try {
    const { name, type, description, tasks = [] } = req.body;
    if (!name || !type) { res.status(400).json({ error: "name and type required" }); return; }
    const [tmpl] = await db.insert(workflowTemplatesTable).values({
      name, type, description: description || null,
      createdById: req.user!.id,
    }).returning();
    if (tasks.length > 0) {
      await db.insert(templateTasksTable).values(
        tasks.map((t: any, i: number) => ({
          templateId: tmpl.id,
          title: t.title,
          description: t.description || null,
          category: t.category || null,
          orderIndex: i,
          defaultAssigneeRole: t.defaultAssigneeRole || null,
          dueInDays: t.dueInDays ?? null,
        }))
      );
    }
    const allTasks = await db.select().from(templateTasksTable)
      .where(eq(templateTasksTable.templateId, tmpl.id))
      .orderBy(asc(templateTasksTable.orderIndex));
    res.status(201).json({ ...tmpl, tasks: allTasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/onboarding/templates/:id
router.put("/onboarding/templates/:id", requireAuth, requireHRAccess, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, tasks } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    const [updated] = await db.update(workflowTemplatesTable).set(updates)
      .where(eq(workflowTemplatesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    if (Array.isArray(tasks)) {
      await db.delete(templateTasksTable).where(eq(templateTasksTable.templateId, id));
      if (tasks.length > 0) {
        await db.insert(templateTasksTable).values(
          tasks.map((t: any, i: number) => ({
            templateId: id,
            title: t.title,
            description: t.description || null,
            category: t.category || null,
            orderIndex: i,
            defaultAssigneeRole: t.defaultAssigneeRole || null,
            dueInDays: t.dueInDays ?? null,
          }))
        );
      }
    }
    const allTasks = await db.select().from(templateTasksTable)
      .where(eq(templateTasksTable.templateId, id))
      .orderBy(asc(templateTasksTable.orderIndex));
    res.json({ ...updated, tasks: allTasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/onboarding/templates/:id
router.delete("/onboarding/templates/:id", requireAuth, requireHRAccess, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(workflowTemplatesTable).where(eq(workflowTemplatesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Workflows ────────────────────────────────────────────────────────────────

// GET /api/onboarding/workflows
router.get("/onboarding/workflows", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, status, employeeId } = req.query;
    let rows = await db.select().from(workflowsTable).orderBy(asc(workflowsTable.createdAt));
    if (type) rows = rows.filter(w => w.type === type);
    if (status) rows = rows.filter(w => w.status === status);
    if (employeeId) rows = rows.filter(w => w.employeeId === parseInt(employeeId as string));

    // Employees can only see their own workflows
    if (req.user!.role === "employee") {
      rows = rows.filter(w => w.employeeId === req.user!.id);
    }

    const result = await Promise.all(rows.map(enrichWorkflow));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/onboarding/workflows  — start a workflow
router.post("/onboarding/workflows", requireAuth, requireHRAccess, async (req: AuthRequest, res) => {
  try {
    const { employeeId, templateId, type, title, notes, targetCompletionDate, tasks = [] } = req.body;
    if (!employeeId || !type || !title) {
      res.status(400).json({ error: "employeeId, type, and title are required" });
      return;
    }

    const [wf] = await db.insert(workflowsTable).values({
      employeeId: parseInt(employeeId),
      templateId: templateId ? parseInt(templateId) : null,
      type,
      title,
      notes: notes || null,
      startedById: req.user!.id,
      targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null,
    }).returning();

    // If tasks provided explicitly, use those; else copy from template
    let taskSource = tasks;
    if (taskSource.length === 0 && templateId) {
      const templateTasks = await db.select().from(templateTasksTable)
        .where(eq(templateTasksTable.templateId, parseInt(templateId)))
        .orderBy(asc(templateTasksTable.orderIndex));
      taskSource = templateTasks.map(t => ({
        title: t.title,
        description: t.description,
        category: t.category,
        orderIndex: t.orderIndex,
        dueInDays: t.dueInDays,
      }));
    }

    if (taskSource.length > 0) {
      await db.insert(workflowTasksTable).values(
        taskSource.map((t: any, i: number) => ({
          workflowId: wf.id,
          title: t.title,
          description: t.description || null,
          category: t.category || null,
          orderIndex: t.orderIndex ?? i,
          assigneeId: t.assigneeId ? parseInt(t.assigneeId) : null,
          dueDate: t.dueInDays != null
            ? new Date(Date.now() + t.dueInDays * 86400000)
            : (t.dueDate ? new Date(t.dueDate) : null),
        }))
      );
    }

    const enriched = await enrichWorkflow(wf);
    res.status(201).json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/onboarding/workflows/:id
router.get("/onboarding/workflows/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [wf] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, id)).limit(1);
    if (!wf) { res.status(404).json({ error: "Not found" }); return; }
    if (req.user!.role === "employee" && wf.employeeId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    res.json(await enrichWorkflow(wf));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/onboarding/workflows/:id — update workflow meta (title, notes, status, targetCompletionDate)
router.put("/onboarding/workflows/:id", requireAuth, requireHRAccess, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, notes, status, targetCompletionDate } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) {
      updates.status = status;
      if (status === "completed") updates.completedAt = new Date();
    }
    if (targetCompletionDate !== undefined)
      updates.targetCompletionDate = targetCompletionDate ? new Date(targetCompletionDate) : null;
    const [updated] = await db.update(workflowsTable).set(updates)
      .where(eq(workflowsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await enrichWorkflow(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/onboarding/workflows/:id
router.delete("/onboarding/workflows/:id", requireAuth, requireHRAccess, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(workflowsTable).where(eq(workflowsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Workflow Tasks ───────────────────────────────────────────────────────────

// PATCH /api/onboarding/tasks/:id  — update a single task (status, assignee, notes)
router.patch("/onboarding/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, assigneeId, notes, title, description, category, dueDate } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) updates.assigneeId = assigneeId ? parseInt(assigneeId) : null;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) {
      updates.status = status;
      if (status === "completed") {
        updates.completedAt = new Date();
        updates.completedById = req.user!.id;
      } else {
        updates.completedAt = null;
        updates.completedById = null;
      }
    }

    const [updated] = await db.update(workflowTasksTable).set(updates)
      .where(eq(workflowTasksTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    // Auto-complete workflow if all tasks done
    const allTasks = await db.select().from(workflowTasksTable)
      .where(eq(workflowTasksTable.workflowId, updated.workflowId));
    const allDone = allTasks.every(t => t.status === "completed" || t.status === "skipped");
    if (allDone) {
      await db.update(workflowsTable).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(workflowsTable.id, updated.workflowId));
    }

    const [wf] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, updated.workflowId)).limit(1);
    res.json(await enrichWorkflow(wf));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/onboarding/workflows/:id/tasks — add a custom task to a workflow
router.post("/onboarding/workflows/:id/tasks", requireAuth, requireHRAccess, async (req: AuthRequest, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const { title, description, category, assigneeId, dueDate, notes } = req.body;
    if (!title) { res.status(400).json({ error: "title required" }); return; }

    const existingTasks = await db.select().from(workflowTasksTable)
      .where(eq(workflowTasksTable.workflowId, workflowId));
    const maxOrder = existingTasks.length > 0
      ? Math.max(...existingTasks.map(t => t.orderIndex)) + 1
      : 0;

    await db.insert(workflowTasksTable).values({
      workflowId,
      title,
      description: description || null,
      category: category || null,
      orderIndex: maxOrder,
      assigneeId: assigneeId ? parseInt(assigneeId) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
    });

    const [wf] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, workflowId)).limit(1);
    if (!wf) { res.status(404).json({ error: "Not found" }); return; }
    res.status(201).json(await enrichWorkflow(wf));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/onboarding/tasks/:id
router.delete("/onboarding/tasks/:id", requireAuth, requireHRAccess, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [task] = await db.select().from(workflowTasksTable).where(eq(workflowTasksTable.id, id)).limit(1);
    if (!task) { res.status(404).json({ error: "Not found" }); return; }
    await db.delete(workflowTasksTable).where(eq(workflowTasksTable.id, id));
    const [wf] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, task.workflowId)).limit(1);
    if (!wf) { res.json({ success: true }); return; }
    res.json(await enrichWorkflow(wf));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Workflow Documents ───────────────────────────────────────────────────────

// GET /api/onboarding/workflows/:id/documents
router.get("/onboarding/workflows/:id/documents", requireAuth, async (req: AuthRequest, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const docs = await db
      .select({
        id: onboardingDocumentsTable.id,
        workflowId: onboardingDocumentsTable.workflowId,
        name: onboardingDocumentsTable.name,
        fileType: onboardingDocumentsTable.fileType,
        notes: onboardingDocumentsTable.notes,
        createdAt: onboardingDocumentsTable.createdAt,
        uploadedById: onboardingDocumentsTable.uploadedById,
        uploadedByName: usersTable.name,
      })
      .from(onboardingDocumentsTable)
      .leftJoin(usersTable, eq(onboardingDocumentsTable.uploadedById, usersTable.id))
      .where(eq(onboardingDocumentsTable.workflowId, workflowId))
      .orderBy(desc(onboardingDocumentsTable.createdAt));
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/onboarding/documents/:docId/download  (returns base64 file data)
router.get("/onboarding/documents/:docId/download", requireAuth, async (req: AuthRequest, res) => {
  try {
    const docId = parseInt(req.params.docId);
    const [doc] = await db.select().from(onboardingDocumentsTable).where(eq(onboardingDocumentsTable.id, docId)).limit(1);
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ fileData: doc.fileData, fileType: doc.fileType, name: doc.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/onboarding/workflows/:id/documents
router.post("/onboarding/workflows/:id/documents", requireAuth, async (req: AuthRequest, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const { name, fileData, fileType, notes } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Document name required" }); return; }

    const [doc] = await db.insert(onboardingDocumentsTable).values({
      workflowId,
      name: name.trim(),
      fileData: fileData || null,
      fileType: fileType || null,
      notes: notes || null,
      uploadedById: req.user!.id,
    }).returning();

    res.status(201).json({ ...doc, uploadedByName: req.user!.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/onboarding/documents/:docId
router.delete("/onboarding/documents/:docId", requireAuth, requireHRAccess, async (req: AuthRequest, res) => {
  try {
    const docId = parseInt(req.params.docId);
    await db.delete(onboardingDocumentsTable).where(eq(onboardingDocumentsTable.id, docId));
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
