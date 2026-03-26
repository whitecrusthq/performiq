import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, customRolesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth";

const router = Router();

const formatUser = (u: typeof usersTable.$inferSelect, customRole?: typeof customRolesTable.$inferSelect | null) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  customRoleId: u.customRoleId,
  customRole: customRole ? { id: customRole.id, name: customRole.name, permissionLevel: customRole.permissionLevel } : null,
  managerId: u.managerId,
  department: u.department,
  jobTitle: u.jobTitle,
  createdAt: u.createdAt,
});

async function getUserWithRole(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return null;
  let customRole = null;
  if (user.customRoleId) {
    const [cr] = await db.select().from(customRolesTable).where(eq(customRolesTable.id, user.customRoleId)).limit(1);
    customRole = cr ?? null;
  }
  return formatUser(user, customRole);
}

router.get("/users", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.name);
    const customRoles = await db.select().from(customRolesTable);
    const roleMap = new Map(customRoles.map(r => [r.id, r]));
    res.json(users.map(u => formatUser(u, u.customRoleId ? roleMap.get(u.customRoleId) ?? null : null)));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/users", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, password, role, customRoleId, managerId, department, jobTitle } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    // If a custom role is assigned, derive the base permission from it
    let effectiveRole = role;
    if (customRoleId) {
      const [cr] = await db.select().from(customRolesTable).where(eq(customRolesTable.id, Number(customRoleId))).limit(1);
      if (cr) effectiveRole = cr.permissionLevel;
    }
    const [user] = await db.insert(usersTable).values({
      name, email, passwordHash, role: effectiveRole, customRoleId: customRoleId ? Number(customRoleId) : null, managerId, department, jobTitle,
    }).returning();
    const result = await getUserWithRole(user.id);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.code === "23505") res.status(409).json({ error: "Email already exists" });
    else res.status(500).json({ error: "Server error" });
  }
});

router.get("/users/:id", requireAuth, async (req, res) => {
  try {
    const result = await getUserWithRole(Number(req.params.id));
    if (!result) { res.status(404).json({ error: "User not found" }); return; }
    res.json(result);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, password, role, customRoleId, managerId, department, jobTitle } = req.body;
    const updates: Record<string, any> = { name, email, managerId, department, jobTitle };
    updates.customRoleId = customRoleId ? Number(customRoleId) : null;

    // Derive effective permission level from custom role if assigned
    if (customRoleId) {
      const [cr] = await db.select().from(customRolesTable).where(eq(customRolesTable.id, Number(customRoleId))).limit(1);
      updates.role = cr ? cr.permissionLevel : (role ?? "employee");
    } else {
      updates.role = role ?? "employee";
    }

    if (password && password.trim() !== "") {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    const [user] = await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, Number(req.params.id)))
      .returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const result = await getUserWithRole(user.id);
    res.json(result);
  } catch (err) {
    console.error("PUT /users/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/users/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    if (Number(req.params.id) === req.user!.id) {
      res.status(400).json({ error: "Cannot delete yourself" });
      return;
    }
    await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
    res.json({ message: "User deleted" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
