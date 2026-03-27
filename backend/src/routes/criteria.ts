import { Router } from "express";
import { db, criteriaTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/criteria", requireAuth, async (_req, res) => {
  try {
    const criteria = await db.select().from(criteriaTable).orderBy(criteriaTable.category, criteriaTable.name);
    res.json(criteria);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/criteria", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, description, category, weight } = req.body;
    const [criterion] = await db.insert(criteriaTable).values({ name, description, category, weight }).returning();
    res.status(201).json(criterion);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/criteria/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, description, category, weight } = req.body;
    const [criterion] = await db.update(criteriaTable)
      .set({ name, description, category, weight })
      .where(eq(criteriaTable.id, Number(req.params.id)))
      .returning();
    if (!criterion) { res.status(404).json({ error: "Criterion not found" }); return; }
    res.json(criterion);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/criteria/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await db.delete(criteriaTable).where(eq(criteriaTable.id, Number(req.params.id)));
    res.json({ message: "Criterion deleted" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
