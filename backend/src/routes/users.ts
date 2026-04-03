import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, customRolesTable, staffDocumentsTable } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth";

const ELEVATED_ROLES = ["admin", "super_admin"];
function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (ELEVATED_ROLES.includes(targetRole)) return actorRole === "super_admin";
  return true;
}

const router = Router();

const formatUser = (u: typeof usersTable.$inferSelect, customRole?: typeof customRolesTable.$inferSelect | null) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  customRoleId: u.customRoleId,
  customRole: customRole ? { id: customRole.id, name: customRole.name, permissionLevel: customRole.permissionLevel } : null,
  managerId: u.managerId,
  siteId: u.siteId,
  department: u.department,
  jobTitle: u.jobTitle,
  phone: u.phone,
  staffId: u.staffId,
  profilePhoto: u.profilePhoto,
  isLocked: u.isLocked,
  createdAt: u.createdAt,
  // HR profile fields
  address: u.address,
  city: u.city,
  stateProvince: u.stateProvince,
  country: u.country,
  postalCode: u.postalCode,
  dateOfBirth: u.dateOfBirth,
  gender: u.gender,
  nationalId: u.nationalId,
  startDate: u.startDate,
  emergencyContactName: u.emergencyContactName,
  emergencyContactPhone: u.emergencyContactPhone,
  emergencyContactRelation: u.emergencyContactRelation,
  bankName: u.bankName,
  bankBranch: u.bankBranch,
  bankAccountNumber: u.bankAccountNumber,
  bankAccountName: u.bankAccountName,
  taxId: u.taxId,
  pensionId: u.pensionId,
  notes: u.notes,
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


router.get("/users", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const allUsers = await db.select().from(usersTable).orderBy(usersTable.name);
    const customRoles = await db.select().from(customRolesTable);
    const roleMap = new Map(customRoles.map(r => [r.id, r]));
    // Non-super_admins cannot see admin or super_admin accounts
    const visible = req.user!.role === "super_admin"
      ? allUsers
      : allUsers.filter(u => !ELEVATED_ROLES.includes(u.role));
    res.json(visible.map(u => formatUser(u, u.customRoleId ? roleMap.get(u.customRoleId) ?? null : null)));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/users", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { name, email, password, role, customRoleId, managerId, siteId, department, jobTitle, phone, staffId } = req.body;
    if (!siteId) {
      res.status(400).json({ error: "Site is required" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    let effectiveRole = role || "employee";
    if (customRoleId) {
      const [cr] = await db.select().from(customRolesTable).where(eq(customRolesTable.id, Number(customRoleId))).limit(1);
      if (cr) effectiveRole = cr.permissionLevel;
    }
    if (!canAssignRole(req.user!.role, effectiveRole)) {
      res.status(403).json({ error: "Only a Super Admin can assign admin or super_admin roles" });
      return;
    }
    const [user] = await db.insert(usersTable).values({
      name, email, passwordHash, role: effectiveRole, customRoleId: customRoleId ? Number(customRoleId) : null, managerId, siteId: Number(siteId), department, jobTitle, phone: phone || null, staffId: staffId || null,
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

router.put("/users/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    // Only super_admin can edit admin or super_admin accounts
    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, Number(req.params.id))).limit(1);
    if (targetUser && ELEVATED_ROLES.includes(targetUser.role) && req.user!.role !== "super_admin") {
      res.status(403).json({ error: "Only a Super Admin can edit admin or super_admin accounts" });
      return;
    }

    const { name, email, password, role, customRoleId, managerId, siteId, department, jobTitle, phone, staffId } = req.body;
    const updates: Record<string, any> = { name, email, managerId, siteId: siteId ? Number(siteId) : null, department, jobTitle, phone: phone || null, staffId: staffId || null };
    updates.customRoleId = customRoleId ? Number(customRoleId) : null;

    // Derive effective permission level from custom role if assigned
    if (customRoleId) {
      const [cr] = await db.select().from(customRolesTable).where(eq(customRolesTable.id, Number(customRoleId))).limit(1);
      updates.role = cr ? cr.permissionLevel : (role ?? "employee");
    } else {
      updates.role = role ?? "employee";
    }

    if (!canAssignRole(req.user!.role, updates.role)) {
      res.status(403).json({ error: "Only a Super Admin can assign admin or super_admin roles" });
      return;
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

// PUT /users/:id/profile-photo — admin or the user themselves sets a reference profile photo
router.put("/users/:id/profile-photo", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    // Admins/managers can set anyone's photo; employees can only set their own
    if (role === "employee" && actorId !== targetId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { profilePhoto } = req.body as { profilePhoto: string };
    if (!profilePhoto) return res.status(400).json({ error: "profilePhoto is required" });
    const [updated] = await db.update(usersTable)
      .set({ profilePhoto })
      .where(eq(usersTable.id, targetId))
      .returning({ id: usersTable.id, name: usersTable.name, profilePhoto: usersTable.profilePhoto });
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /users/:id/hr-profile — update extended HR/payroll fields (admin or self)
router.put("/users/:id/hr-profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const {
      address, city, stateProvince, country, postalCode,
      dateOfBirth, gender, nationalId, startDate,
      emergencyContactName, emergencyContactPhone, emergencyContactRelation,
      bankName, bankBranch, bankAccountNumber, bankAccountName, taxId, pensionId, notes,
    } = req.body;

    const [updated] = await db.update(usersTable).set({
      address: address ?? null,
      city: city ?? null,
      stateProvince: stateProvince ?? null,
      country: country ?? null,
      postalCode: postalCode ?? null,
      dateOfBirth: dateOfBirth ?? null,
      gender: gender ?? null,
      nationalId: nationalId ?? null,
      startDate: startDate ?? null,
      emergencyContactName: emergencyContactName ?? null,
      emergencyContactPhone: emergencyContactPhone ?? null,
      emergencyContactRelation: emergencyContactRelation ?? null,
      bankName: bankName ?? null,
      bankBranch: bankBranch ?? null,
      bankAccountNumber: bankAccountNumber ?? null,
      bankAccountName: bankAccountName ?? null,
      taxId: taxId ?? null,
      pensionId: pensionId ?? null,
      notes: notes ?? null,
    }).where(eq(usersTable.id, targetId)).returning();

    if (!updated) return res.status(404).json({ error: "User not found" });
    const result = await getUserWithRole(updated.id);
    res.json(result);
  } catch (err) {
    console.error("PUT /users/:id/hr-profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/users/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    if (Number(req.params.id) === req.user!.id) {
      res.status(400).json({ error: "Cannot delete yourself" });
      return;
    }
    // Only super_admin can delete admin or super_admin accounts
    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, Number(req.params.id))).limit(1);
    if (targetUser && ELEVATED_ROLES.includes(targetUser.role) && req.user!.role !== "super_admin") {
      res.status(403).json({ error: "Only a Super Admin can delete admin or super_admin accounts" });
      return;
    }
    await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
    res.json({ message: "User deleted" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── Staff Documents ───────────────────────────────────────────────────────────

// GET /users/:id/documents
router.get("/users/:id/documents", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });

    const docs = await db.select({
      id: staffDocumentsTable.id,
      name: staffDocumentsTable.name,
      documentType: staffDocumentsTable.documentType,
      receivedDate: staffDocumentsTable.receivedDate,
      notes: staffDocumentsTable.notes,
      createdAt: staffDocumentsTable.createdAt,
      uploadedById: staffDocumentsTable.uploadedById,
      uploadedByName: usersTable.name,
    })
    .from(staffDocumentsTable)
    .leftJoin(usersTable, eq(staffDocumentsTable.uploadedById, usersTable.id))
    .where(eq(staffDocumentsTable.userId, targetId))
    .orderBy(desc(staffDocumentsTable.createdAt));

    res.json(docs);
  } catch (err) {
    console.error("GET /users/:id/documents error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /users/:id/documents
router.post("/users/:id/documents", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });

    const { name, documentType, receivedDate, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Document name is required" });

    const [doc] = await db.insert(staffDocumentsTable).values({
      userId: targetId,
      name: name.trim(),
      documentType: documentType || "other",
      receivedDate: receivedDate || null,
      notes: notes || null,
      uploadedById: actorId,
    }).returning();

    res.status(201).json({ ...doc, uploadedByName: req.user!.name });
  } catch (err) {
    console.error("POST /users/:id/documents error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /users/:id/documents/:docId
router.delete("/users/:id/documents/:docId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    const docId = Number(req.params.docId);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });

    await db.delete(staffDocumentsTable)
      .where(eq(staffDocumentsTable.id, docId));
    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error("DELETE /users/:id/documents/:docId error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
