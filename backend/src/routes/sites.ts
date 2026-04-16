import { Router } from "express";
import { db, sitesTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/sites", requireAuth, async (_req, res) => {
  try {
    const sites = await db.select().from(sitesTable).orderBy(sitesTable.name);
    res.json(sites);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/sites", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, address, city, region, country, description } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "Site name is required" });
      return;
    }
    const [site] = await db.insert(sitesTable).values({ name: name.trim(), address, city, region, country, description }).returning();
    res.status(201).json(site);
  } catch (err: any) {
    if (err.code === "23505") res.status(409).json({ error: "A site with this name already exists" });
    else res.status(500).json({ error: "Server error" });
  }
});

router.put("/sites/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, address, city, region, country, description } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "Site name is required" });
      return;
    }
    const [site] = await db.update(sitesTable)
      .set({ name: name.trim(), address, city, region, country, description })
      .where(eq(sitesTable.id, Number(req.params.id)))
      .returning();
    if (!site) { res.status(404).json({ error: "Site not found" }); return; }
    res.json(site);
  } catch (err: any) {
    if (err.code === "23505") res.status(409).json({ error: "A site with this name already exists" });
    else res.status(500).json({ error: "Server error" });
  }
});

router.delete("/sites/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await db.delete(sitesTable).where(eq(sitesTable.id, Number(req.params.id)));
    res.json({ message: "Site deleted" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
