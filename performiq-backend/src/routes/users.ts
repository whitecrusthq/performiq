import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, customRolesTable, staffDocumentsTable, staffBeneficiariesTable, staffWorkExperienceTable, staffEducationTable, staffReferencesTable } from "../db/index.js";
import { eq, desc, asc } from "drizzle-orm";
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
  // Name breakdown
  surname: u.surname,
  firstName: u.firstName,
  middleName: u.middleName,
  // Personal info
  address: u.address,
  permanentAddress: u.permanentAddress,
  temporaryAddress: u.temporaryAddress,
  city: u.city,
  stateProvince: u.stateProvince,
  country: u.country,
  postalCode: u.postalCode,
  dateOfBirth: u.dateOfBirth,
  gender: u.gender,
  maritalStatus: u.maritalStatus,
  maidenName: u.maidenName,
  religion: u.religion,
  stateOfOrigin: u.stateOfOrigin,
  nationality: u.nationality,
  nationalId: u.nationalId,
  hobbies: u.hobbies,
  // Spouse & family
  spouseName: u.spouseName,
  spouseOccupation: u.spouseOccupation,
  numberOfChildren: u.numberOfChildren,
  // Employment
  startDate: u.startDate,
  // Next of kin
  emergencyContactName: u.emergencyContactName,
  emergencyContactPhone: u.emergencyContactPhone,
  emergencyContactRelation: u.emergencyContactRelation,
  emergencyContactAddress: u.emergencyContactAddress,
  // Financial
  bankName: u.bankName,
  bankBranch: u.bankBranch,
  bankAccountNumber: u.bankAccountNumber,
  bankAccountName: u.bankAccountName,
  taxId: u.taxId,
  pensionId: u.pensionId,
  pfaName: u.pfaName,
  rsaPin: u.rsaPin,
  hmo: u.hmo,
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
    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, Number(req.params.id))).limit(1);
    if (targetUser && ELEVATED_ROLES.includes(targetUser.role) && req.user!.role !== "super_admin") {
      res.status(403).json({ error: "Only a Super Admin can edit admin or super_admin accounts" });
      return;
    }

    const { name, email, password, role, customRoleId, managerId, siteId, department, jobTitle, phone, staffId } = req.body;
    const updates: Record<string, any> = { name, email, managerId, siteId: siteId ? Number(siteId) : null, department, jobTitle, phone: phone || null, staffId: staffId || null };
    updates.customRoleId = customRoleId ? Number(customRoleId) : null;

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

router.put("/users/:id/profile-photo", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { profilePhoto } = req.body as { profilePhoto: string | null };
    if (profilePhoto === undefined) return res.status(400).json({ error: "profilePhoto is required" });
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
      // Name
      surname, firstName, middleName,
      // Personal
      address, permanentAddress, temporaryAddress, city, stateProvince, country, postalCode,
      dateOfBirth, gender, maritalStatus, maidenName, religion, stateOfOrigin, nationality,
      nationalId, hobbies,
      // Spouse & family
      spouseName, spouseOccupation, numberOfChildren,
      // Employment
      startDate,
      // Next of kin
      emergencyContactName, emergencyContactPhone, emergencyContactRelation, emergencyContactAddress,
      // Financial
      bankName, bankBranch, bankAccountNumber, bankAccountName, taxId, pensionId, pfaName, rsaPin, hmo,
      notes,
    } = req.body;

    const [updated] = await db.update(usersTable).set({
      surname: surname ?? null,
      firstName: firstName ?? null,
      middleName: middleName ?? null,
      address: address ?? null,
      permanentAddress: permanentAddress ?? null,
      temporaryAddress: temporaryAddress ?? null,
      city: city ?? null,
      stateProvince: stateProvince ?? null,
      country: country ?? null,
      postalCode: postalCode ?? null,
      dateOfBirth: dateOfBirth ?? null,
      gender: gender ?? null,
      maritalStatus: maritalStatus ?? null,
      maidenName: maidenName ?? null,
      religion: religion ?? null,
      stateOfOrigin: stateOfOrigin ?? null,
      nationality: nationality ?? null,
      nationalId: nationalId ?? null,
      hobbies: hobbies ?? null,
      spouseName: spouseName ?? null,
      spouseOccupation: spouseOccupation ?? null,
      numberOfChildren: numberOfChildren != null ? Number(numberOfChildren) : null,
      startDate: startDate ?? null,
      emergencyContactName: emergencyContactName ?? null,
      emergencyContactPhone: emergencyContactPhone ?? null,
      emergencyContactRelation: emergencyContactRelation ?? null,
      emergencyContactAddress: emergencyContactAddress ?? null,
      bankName: bankName ?? null,
      bankBranch: bankBranch ?? null,
      bankAccountNumber: bankAccountNumber ?? null,
      bankAccountName: bankAccountName ?? null,
      taxId: taxId ?? null,
      pensionId: pensionId ?? null,
      pfaName: pfaName ?? null,
      rsaPin: rsaPin ?? null,
      hmo: hmo ?? null,
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

router.delete("/users/:id/documents/:docId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    const docId = Number(req.params.docId);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    await db.delete(staffDocumentsTable).where(eq(staffDocumentsTable.id, docId));
    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error("DELETE /users/:id/documents/:docId error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Beneficiaries ─────────────────────────────────────────────────────────────

router.get("/users/:id/beneficiaries", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    const rows = await db.select().from(staffBeneficiariesTable)
      .where(eq(staffBeneficiariesTable.userId, targetId))
      .orderBy(asc(staffBeneficiariesTable.orderIndex));
    res.json(rows);
  } catch (err) {
    console.error("GET /users/:id/beneficiaries error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/users/:id/beneficiaries", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    const { name, address, phoneNumber, orderIndex } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Beneficiary name is required" });
    const [row] = await db.insert(staffBeneficiariesTable).values({
      userId: targetId, name: name.trim(), address: address || null, phoneNumber: phoneNumber || null,
      orderIndex: orderIndex ?? 0,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("POST /users/:id/beneficiaries error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/users/:id/beneficiaries/:rowId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    const { name, address, phoneNumber, orderIndex } = req.body;
    const [row] = await db.update(staffBeneficiariesTable)
      .set({ name: name?.trim() || undefined, address: address ?? null, phoneNumber: phoneNumber ?? null, orderIndex: orderIndex ?? undefined })
      .where(eq(staffBeneficiariesTable.id, Number(req.params.rowId)))
      .returning();
    res.json(row);
  } catch (err) {
    console.error("PUT /users/:id/beneficiaries/:rowId error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/users/:id/beneficiaries/:rowId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    await db.delete(staffBeneficiariesTable).where(eq(staffBeneficiariesTable.id, Number(req.params.rowId)));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── Work Experience ───────────────────────────────────────────────────────────

router.get("/users/:id/work-experience", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    const rows = await db.select().from(staffWorkExperienceTable)
      .where(eq(staffWorkExperienceTable.userId, targetId))
      .orderBy(asc(staffWorkExperienceTable.orderIndex));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/users/:id/work-experience", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    const { companyName, companyAddress, positionHeld, fromDate, toDate, reasonForLeaving, orderIndex } = req.body;
    if (!companyName?.trim()) return res.status(400).json({ error: "Company name is required" });
    const [row] = await db.insert(staffWorkExperienceTable).values({
      userId: targetId, companyName: companyName.trim(),
      companyAddress: companyAddress || null, positionHeld: positionHeld || null,
      fromDate: fromDate || null, toDate: toDate || null, reasonForLeaving: reasonForLeaving || null,
      orderIndex: orderIndex ?? 0,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/users/:id/work-experience/:rowId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    const { companyName, companyAddress, positionHeld, fromDate, toDate, reasonForLeaving, orderIndex } = req.body;
    const [row] = await db.update(staffWorkExperienceTable)
      .set({ companyName: companyName?.trim() || undefined, companyAddress: companyAddress ?? null, positionHeld: positionHeld ?? null, fromDate: fromDate ?? null, toDate: toDate ?? null, reasonForLeaving: reasonForLeaving ?? null, orderIndex: orderIndex ?? undefined })
      .where(eq(staffWorkExperienceTable.id, Number(req.params.rowId)))
      .returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/users/:id/work-experience/:rowId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    await db.delete(staffWorkExperienceTable).where(eq(staffWorkExperienceTable.id, Number(req.params.rowId)));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── Education ─────────────────────────────────────────────────────────────────

router.get("/users/:id/education", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    const rows = await db.select().from(staffEducationTable)
      .where(eq(staffEducationTable.userId, targetId))
      .orderBy(asc(staffEducationTable.orderIndex));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/users/:id/education", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    const { schoolAttended, certificateObtained, fromDate, toDate, orderIndex } = req.body;
    if (!schoolAttended?.trim()) return res.status(400).json({ error: "School name is required" });
    const [row] = await db.insert(staffEducationTable).values({
      userId: targetId, schoolAttended: schoolAttended.trim(),
      certificateObtained: certificateObtained || null,
      fromDate: fromDate || null, toDate: toDate || null,
      orderIndex: orderIndex ?? 0,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/users/:id/education/:rowId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    const { schoolAttended, certificateObtained, fromDate, toDate, orderIndex } = req.body;
    const [row] = await db.update(staffEducationTable)
      .set({ schoolAttended: schoolAttended?.trim() || undefined, certificateObtained: certificateObtained ?? null, fromDate: fromDate ?? null, toDate: toDate ?? null, orderIndex: orderIndex ?? undefined })
      .where(eq(staffEducationTable.id, Number(req.params.rowId)))
      .returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/users/:id/education/:rowId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    await db.delete(staffEducationTable).where(eq(staffEducationTable.id, Number(req.params.rowId)));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── References ────────────────────────────────────────────────────────────────

router.get("/users/:id/references", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    const rows = await db.select().from(staffReferencesTable)
      .where(eq(staffReferencesTable.userId, targetId))
      .orderBy(asc(staffReferencesTable.refNumber));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/users/:id/references", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: actorId } = req.user!;
    const targetId = Number(req.params.id);
    if (role === "employee" && actorId !== targetId) return res.status(403).json({ error: "Forbidden" });
    const references: any[] = req.body;
    await db.delete(staffReferencesTable).where(eq(staffReferencesTable.userId, targetId));
    if (references.length > 0) {
      await db.insert(staffReferencesTable).values(
        references.map((r, i) => ({
          userId: targetId,
          refNumber: i + 1,
          name: r.name || null,
          address: r.address || null,
          occupation: r.occupation || null,
          age: r.age || null,
          telephone: r.telephone || null,
          email: r.email || null,
        }))
      );
    }
    const rows = await db.select().from(staffReferencesTable)
      .where(eq(staffReferencesTable.userId, targetId))
      .orderBy(asc(staffReferencesTable.refNumber));
    res.json(rows);
  } catch (err) {
    console.error("PUT /users/:id/references error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
