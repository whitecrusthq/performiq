import { Router } from "express";
import { db, customRolesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/custom-roles", requireAuth, async (_req, res) => {
  try {
    const roles = await db.select().from(customRolesTable).orderBy(customRolesTable.name);
    res.json(roles);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/custom-roles", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, permissionLevel, description } = req.body;
    if (!name || !permissionLevel) {
      res.status(400).json({ error: "name and permissionLevel are required" }); return;
    }
    const [role] = await db.insert(customRolesTable).values({ name, permissionLevel, description }).returning();
    res.status(201).json(role);
  } catch (err: any) {
    if (err.code === "23505") res.status(409).json({ error: "Role name already exists" });
    else res.status(500).json({ error: "Server error" });
  }
});

router.put("/custom-roles/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, permissionLevel, description } = req.body;
    const [role] = await db.update(customRolesTable)
      .set({ name, permissionLevel, description })
      .where(eq(customRolesTable.id, Number(req.params.id)))
      .returning();
    if (!role) { res.status(404).json({ error: "Not found" }); return; }
    res.json(role);
  } catch (err: any) {
    if (err.code === "23505") res.status(409).json({ error: "Role name already exists" });
    else res.status(500).json({ error: "Server error" });
  }
});

router.delete("/custom-roles/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    // Clear the customRoleId from any users assigned this role
    await db.update(usersTable).set({ customRoleId: null }).where(eq(usersTable.customRoleId, Number(req.params.id)));
    await db.delete(customRolesTable).where(eq(customRolesTable.id, Number(req.params.id)));
    res.json({ message: "Role deleted" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
