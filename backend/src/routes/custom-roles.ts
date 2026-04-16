import { Router } from "express";
import { db, customRolesTable, usersTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

function parseMenuPerms(raw: string | null | undefined): string[] {
  try { return JSON.parse(raw ?? "[]") ?? []; } catch { return []; }
}

function formatRole(r: typeof customRolesTable.$inferSelect) {
  return { ...r, menuPermissions: parseMenuPerms(r.menuPermissions) };
}

router.get("/custom-roles", requireAuth, async (_req, res) => {
  try {
    const roles = await db.select().from(customRolesTable).orderBy(customRolesTable.name);
    res.json(roles.map(formatRole));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/custom-roles", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, permissionLevel, description, menuPermissions } = req.body;
    if (!name || !permissionLevel) {
      res.status(400).json({ error: "name and permissionLevel are required" }); return;
    }
    const menuPermsJson = JSON.stringify(Array.isArray(menuPermissions) ? menuPermissions : []);
    const [role] = await db.insert(customRolesTable)
      .values({ name, permissionLevel, description, menuPermissions: menuPermsJson })
      .returning();
    res.status(201).json(formatRole(role));
  } catch (err: any) {
    if (err.code === "23505") res.status(409).json({ error: "Role name already exists" });
    else res.status(500).json({ error: "Server error" });
  }
});

router.put("/custom-roles/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, permissionLevel, description, menuPermissions } = req.body;
    const menuPermsJson = JSON.stringify(Array.isArray(menuPermissions) ? menuPermissions : []);
    const [role] = await db.update(customRolesTable)
      .set({ name, permissionLevel, description, menuPermissions: menuPermsJson })
      .where(eq(customRolesTable.id, Number(req.params.id)))
      .returning();
    if (!role) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatRole(role));
  } catch (err: any) {
    if (err.code === "23505") res.status(409).json({ error: "Role name already exists" });
    else res.status(500).json({ error: "Server error" });
  }
});

router.delete("/custom-roles/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await db.update(usersTable).set({ customRoleId: null }).where(eq(usersTable.customRoleId, Number(req.params.id)));
    await db.delete(customRolesTable).where(eq(customRolesTable.id, Number(req.params.id)));
    res.json({ message: "Role deleted" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
