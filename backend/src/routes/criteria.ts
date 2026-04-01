import { Router } from "express";
import { db, criteriaTable, criteriaGroupsTable, criteriaGroupItemsTable } from "../db/index.js";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// ─── Criteria ─────────────────────────────────────────────────────────────────

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
    const { name, description, category, weight, type, targetValue, unit } = req.body;
    const [criterion] = await db.insert(criteriaTable).values({
      name, description, category, weight,
      type: type ?? "rating",
      targetValue: targetValue ?? null,
      unit: unit ?? null,
    }).returning();
    res.status(201).json(criterion);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/criteria/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, description, category, weight, type, targetValue, unit } = req.body;
    const [criterion] = await db.update(criteriaTable)
      .set({ name, description, category, weight, type: type ?? "rating", targetValue: targetValue ?? null, unit: unit ?? null })
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
    await db.delete(criteriaGroupItemsTable).where(eq(criteriaGroupItemsTable.criterionId, Number(req.params.id)));
    await db.delete(criteriaTable).where(eq(criteriaTable.id, Number(req.params.id)));
    res.json({ message: "Criterion deleted" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Criteria Groups ──────────────────────────────────────────────────────────

// GET /criteria-groups — list all groups with their criteria
router.get("/criteria-groups", requireAuth, async (_req, res) => {
  try {
    const groups = await db.select().from(criteriaGroupsTable).orderBy(criteriaGroupsTable.name);
    const items = await db.select().from(criteriaGroupItemsTable);
    const allCriteria = await db.select().from(criteriaTable);
    const criteriaMap = new Map(allCriteria.map(c => [c.id, c]));

    const enriched = groups.map(g => ({
      ...g,
      criteria: items
        .filter(i => i.groupId === g.id)
        .map(i => criteriaMap.get(i.criterionId))
        .filter(Boolean),
    }));
    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /criteria-groups — create a group
router.post("/criteria-groups", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, description, criteriaIds } = req.body;
    const [group] = await db.insert(criteriaGroupsTable).values({ name, description }).returning();
    if (criteriaIds?.length) {
      await db.insert(criteriaGroupItemsTable).values(
        criteriaIds.map((cid: number) => ({ groupId: group.id, criterionId: cid }))
      );
    }
    res.status(201).json(group);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /criteria-groups/:id — update group name/description and replace criteria list
router.put("/criteria-groups/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const gid = Number(req.params.id);
    const { name, description, criteriaIds } = req.body;
    const [group] = await db.update(criteriaGroupsTable)
      .set({ name, description })
      .where(eq(criteriaGroupsTable.id, gid))
      .returning();
    if (!group) { res.status(404).json({ error: "Group not found" }); return; }

    // Replace criteria list
    await db.delete(criteriaGroupItemsTable).where(eq(criteriaGroupItemsTable.groupId, gid));
    if (criteriaIds?.length) {
      await db.insert(criteriaGroupItemsTable).values(
        criteriaIds.map((cid: number) => ({ groupId: gid, criterionId: cid }))
      );
    }
    res.json(group);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /criteria-groups/:id
router.delete("/criteria-groups/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const gid = Number(req.params.id);
    await db.delete(criteriaGroupItemsTable).where(eq(criteriaGroupItemsTable.groupId, gid));
    await db.delete(criteriaGroupsTable).where(eq(criteriaGroupsTable.id, gid));
    res.json({ message: "Group deleted" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
