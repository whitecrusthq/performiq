import { Router } from "express";
import { db, departmentsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/departments", requireAuth, async (_req, res) => {
  try {
    const depts = await db.select().from(departmentsTable).orderBy(departmentsTable.name);

    // Attach employee counts
    const users = await db.select({ id: usersTable.id, department: usersTable.department }).from(usersTable);
    const countMap = users.reduce<Record<string, number>>((acc, u) => {
      if (u.department) acc[u.department] = (acc[u.department] || 0) + 1;
      return acc;
    }, {});

    const result = depts.map(d => ({
      ...d,
      employeeCount: countMap[d.name] || 0,
    }));

    res.json(result);
  } catch (err) {
    console.error("GET /departments error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/departments", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Department name is required" });

    const [created] = await db.insert(departmentsTable).values({
      name: name.trim(),
      description: description?.trim() || null,
    }).returning();

    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "A department with that name already exists" });
    console.error("POST /departments error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/departments/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Department name is required" });

    const [updated] = await db.update(departmentsTable)
      .set({ name: name.trim(), description: description?.trim() || null })
      .where(eq(departmentsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Department not found" });
    res.json(updated);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "A department with that name already exists" });
    console.error("PUT /departments/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/departments/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(departmentsTable).where(eq(departmentsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Department not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /departments/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
