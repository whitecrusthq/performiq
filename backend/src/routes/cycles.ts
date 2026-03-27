import { Router } from "express";
import { db, cyclesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/cycles", requireAuth, async (_req, res) => {
  try {
    const cycles = await db.select().from(cyclesTable).orderBy(cyclesTable.startDate);
    res.json(cycles);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/cycles", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;
    const [cycle] = await db.insert(cyclesTable).values({ name, startDate, endDate, status }).returning();
    res.status(201).json(cycle);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/cycles/:id", requireAuth, async (req, res) => {
  try {
    const [cycle] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, Number(req.params.id))).limit(1);
    if (!cycle) { res.status(404).json({ error: "Cycle not found" }); return; }
    res.json(cycle);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/cycles/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;
    const [cycle] = await db.update(cyclesTable)
      .set({ name, startDate, endDate, status })
      .where(eq(cyclesTable.id, Number(req.params.id)))
      .returning();
    if (!cycle) { res.status(404).json({ error: "Cycle not found" }); return; }
    res.json(cycle);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/cycles/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await db.delete(cyclesTable).where(eq(cyclesTable.id, Number(req.params.id)));
    res.json({ message: "Cycle deleted" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
