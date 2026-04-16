import { Router } from "express";
import { db, goalsTable, usersTable } from "../db/index.js";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

async function enrichGoal(goal: typeof goalsTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, goal.userId)).limit(1);
  return {
    ...goal,
    user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, managerId: user.managerId, department: user.department, jobTitle: user.jobTitle, createdAt: user.createdAt } : null,
  };
}

router.get("/goals", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId, cycleId } = req.query;
    const conditions = [];
    if (cycleId) conditions.push(eq(goalsTable.cycleId, Number(cycleId)));
    if (userId) {
      conditions.push(eq(goalsTable.userId, Number(userId)));
    } else if (req.user!.role === "employee") {
      conditions.push(eq(goalsTable.userId, req.user!.id));
    } else if (req.user!.role === "manager") {
      const team = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, req.user!.id));
      const ids = [req.user!.id, ...team.map(m => m.id)];
      conditions.push(inArray(goalsTable.userId, ids));
    }

    const goals = conditions.length > 0
      ? await db.select().from(goalsTable).where(and(...conditions)).orderBy(goalsTable.createdAt)
      : await db.select().from(goalsTable).orderBy(goalsTable.createdAt);

    const enriched = await Promise.all(goals.map(enrichGoal));
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/goals", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, description, cycleId, userId, dueDate, status } = req.body;
    const targetUserId = (req.user!.role === "employee") ? req.user!.id : (userId ?? req.user!.id);
    const [goal] = await db.insert(goalsTable).values({
      title, description, cycleId, dueDate, status: status ?? "not_started",
      userId: targetUserId, progress: 0,
    }).returning();
    const enriched = await enrichGoal(goal);
    res.status(201).json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/goals/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, description, status, dueDate, progress } = req.body;
    const [goal] = await db.update(goalsTable)
      .set({ title, description, status, dueDate, progress })
      .where(eq(goalsTable.id, Number(req.params.id)))
      .returning();
    if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }
    const enriched = await enrichGoal(goal);
    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/goals/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(goalsTable).where(eq(goalsTable.id, Number(req.params.id)));
    res.json({ message: "Goal deleted" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
