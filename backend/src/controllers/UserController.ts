import bcrypt from "bcryptjs";
import { User, CustomRole, StaffDocument, StaffBeneficiary, StaffWorkExperience, StaffEducation, StaffReference, Site, sequelize } from "../models/index.js";
import { QueryTypes } from "sequelize";

const ELEVATED_ROLES = ["admin", "super_admin"];

function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (targetRole === "super_admin") return actorRole === "super_admin";
  if (targetRole === "admin") return actorRole === "admin" || actorRole === "super_admin";
  return true;
}

function formatUser(u: User, customRole?: CustomRole | null) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    customRoleId: u.customRoleId,
    customRole: customRole ? { id: customRole.id, name: customRole.name, permissionLevel: customRole.permissionLevel } : null,
    managerId: u.managerId, siteId: u.siteId, department: u.department, jobTitle: u.jobTitle,
    phone: u.phone, staffId: u.staffId, profilePhoto: u.profilePhoto, isLocked: u.isLocked, createdAt: u.createdAt,
    surname: u.surname, firstName: u.firstName, middleName: u.middleName,
    address: u.address,
    permanentAddress: u.permanentAddress, permanentCity: u.permanentCity, permanentState: u.permanentState,
    permanentCountry: u.permanentCountry, permanentPostalCode: u.permanentPostalCode,
    temporaryAddress: u.temporaryAddress, temporaryCity: u.temporaryCity, temporaryState: u.temporaryState,
    temporaryCountry: u.temporaryCountry, temporaryPostalCode: u.temporaryPostalCode,
    city: u.city, stateProvince: u.stateProvince, country: u.country, postalCode: u.postalCode,
    dateOfBirth: u.dateOfBirth, gender: u.gender, maritalStatus: u.maritalStatus, maidenName: u.maidenName,
    religion: u.religion, stateOfOrigin: u.stateOfOrigin, nationality: u.nationality, nationalId: u.nationalId,
    hobbies: u.hobbies,
    spouseName: u.spouseName, spouseOccupation: u.spouseOccupation, numberOfChildren: u.numberOfChildren, weddingDate: u.weddingDate,
    startDate: u.startDate, probationEndDate: u.probationEndDate, probationStatus: u.probationStatus,
    emergencyContactName: u.emergencyContactName, emergencyContactPhone: u.emergencyContactPhone,
    emergencyContactRelation: u.emergencyContactRelation, emergencyContactAddress: u.emergencyContactAddress,
    bankName: u.bankName, bankBranch: u.bankBranch, bankAccountNumber: u.bankAccountNumber,
    bankAccountName: u.bankAccountName, taxId: u.taxId, pensionId: u.pensionId, pfaName: u.pfaName,
    rsaPin: u.rsaPin, hmo: u.hmo, notes: u.notes,
    require2Fa: !!u.require2Fa, twoFactorEnabled: !!u.twoFactorEnabled,
  };
}

async function getUserWithRole(userId: number) {
  const user = await User.findByPk(userId);
  if (!user) return null;
  let customRole: CustomRole | null = null;
  if (user.customRoleId) {
    customRole = await CustomRole.findByPk(user.customRoleId) ?? null;
  }
  return formatUser(user, customRole);
}

export default class UserController {
  static ELEVATED_ROLES = ELEVATED_ROLES;

  static async getAll(actorRole: string) {
    const allUsers = await User.findAll({ order: [["name", "ASC"]] });
    const customRoles = await CustomRole.findAll();
    const roleMap = new Map<number, CustomRole>(customRoles.map((r: CustomRole) => [r.id, r]));
    const visible = actorRole === "super_admin"
      ? allUsers
      : allUsers.filter((u: User) => u.role !== "super_admin");
    return visible.map((u: User) => formatUser(u, u.customRoleId ? roleMap.get(u.customRoleId) ?? null : null));
  }

  static async create(data: any, actorRole: string) {
    const { name, email, password, role, customRoleId, managerId, siteId, department, jobTitle, phone, staffId } = data;
    if (!siteId) return { error: "Site is required", status: 400 };
    const passwordHash = await bcrypt.hash(password, 10);
    let effectiveRole = role || "employee";
    if (customRoleId) {
      const cr = await CustomRole.findByPk(Number(customRoleId));
      if (cr) effectiveRole = cr.permissionLevel;
    }
    if (!canAssignRole(actorRole, effectiveRole)) {
      return { error: "Only a Super Admin can assign the Super Admin role", status: 403 };
    }
    const user = await User.create({
      name, email, passwordHash, role: effectiveRole,
      customRoleId: customRoleId ? Number(customRoleId) : null,
      managerId, siteId: Number(siteId), department, jobTitle,
      phone: phone || null, staffId: staffId || null,
    });
    const result = await getUserWithRole(user.id);
    return { data: result, status: 201 };
  }

  static async getById(id: number) {
    return getUserWithRole(id);
  }

  static async update(id: number, data: any, actorRole: string) {
    const targetUser = await User.findByPk(id);
    if (targetUser && targetUser.role === "super_admin" && actorRole !== "super_admin") {
      return { error: "Only a Super Admin can edit Super Admin accounts", status: 403 };
    }

    const { name, email, password, role, customRoleId, managerId, siteId, department, jobTitle, phone, staffId, require2Fa } = data;
    const updates: Record<string, any> = {
      name, email, managerId, siteId: siteId ? Number(siteId) : null,
      department, jobTitle, phone: phone || null, staffId: staffId || null,
    };
    updates.customRoleId = customRoleId ? Number(customRoleId) : null;
    if (typeof require2Fa === "boolean") updates.require2Fa = require2Fa;

    if (customRoleId) {
      const cr = await CustomRole.findByPk(Number(customRoleId));
      updates.role = cr ? cr.permissionLevel : (role ?? "employee");
    } else {
      updates.role = role ?? "employee";
    }

    if (!canAssignRole(actorRole, updates.role)) {
      return { error: "Only a Super Admin can assign the Super Admin role", status: 403 };
    }

    if (password && password.trim() !== "") {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    const [count, rows] = await User.update(updates, { where: { id }, returning: true });
    if (count === 0) return { error: "User not found", status: 404 };
    const result = await getUserWithRole(rows[0].id);
    return { data: result };
  }

  static async updateProfilePhoto(targetId: number, profilePhoto: string | null) {
    const [count, rows] = await User.update({ profilePhoto }, { where: { id: targetId }, returning: true });
    if (count === 0) return null;
    return { id: rows[0].id, name: rows[0].name, profilePhoto: rows[0].profilePhoto };
  }

  static async updateHrProfile(targetId: number, data: Record<string, any>) {
    const updates: Record<string, any> = {
      surname: data.surname ?? null, firstName: data.firstName ?? null, middleName: data.middleName ?? null,
      address: data.address ?? null,
      permanentAddress: data.permanentAddress ?? null, permanentCity: data.permanentCity ?? null,
      permanentState: data.permanentState ?? null, permanentCountry: data.permanentCountry ?? null,
      permanentPostalCode: data.permanentPostalCode ?? null,
      temporaryAddress: data.temporaryAddress ?? null, temporaryCity: data.temporaryCity ?? null,
      temporaryState: data.temporaryState ?? null, temporaryCountry: data.temporaryCountry ?? null,
      temporaryPostalCode: data.temporaryPostalCode ?? null,
      city: data.city ?? null, stateProvince: data.stateProvince ?? null, country: data.country ?? null,
      postalCode: data.postalCode ?? null, dateOfBirth: data.dateOfBirth ?? null, gender: data.gender ?? null,
      maritalStatus: data.maritalStatus ?? null, maidenName: data.maidenName ?? null, religion: data.religion ?? null,
      stateOfOrigin: data.stateOfOrigin ?? null, nationality: data.nationality ?? null, nationalId: data.nationalId ?? null,
      hobbies: data.hobbies ?? null,
      spouseName: data.spouseName ?? null, spouseOccupation: data.spouseOccupation ?? null,
      numberOfChildren: data.numberOfChildren != null ? Number(data.numberOfChildren) : null,
      weddingDate: data.weddingDate ?? null,
      startDate: data.startDate ?? null, probationEndDate: data.probationEndDate ?? null,
      probationStatus: data.probationStatus ?? null,
      emergencyContactName: data.emergencyContactName ?? null, emergencyContactPhone: data.emergencyContactPhone ?? null,
      emergencyContactRelation: data.emergencyContactRelation ?? null, emergencyContactAddress: data.emergencyContactAddress ?? null,
      bankName: data.bankName ?? null, bankBranch: data.bankBranch ?? null, bankAccountNumber: data.bankAccountNumber ?? null,
      bankAccountName: data.bankAccountName ?? null, taxId: data.taxId ?? null, pensionId: data.pensionId ?? null,
      pfaName: data.pfaName ?? null, rsaPin: data.rsaPin ?? null, hmo: data.hmo ?? null, notes: data.notes ?? null,
    };
    const [count, rows] = await User.update(updates, { where: { id: targetId }, returning: true });
    if (count === 0) return null;
    return getUserWithRole(rows[0].id);
  }

  static async delete(id: number, actorId: number, actorRole: string) {
    if (id === actorId) return { error: "Cannot delete yourself", status: 400 };
    const targetUser = await User.findByPk(id);
    if (targetUser && targetUser.role === "super_admin" && actorRole !== "super_admin") {
      return { error: "Only a Super Admin can delete Super Admin accounts", status: 403 };
    }
    await User.destroy({ where: { id } });
    return { message: "User deleted" };
  }

  static async getDocuments(targetId: number) {
    const docs = await sequelize.query(
      `SELECT sd.id, sd.name, sd.document_type AS "documentType", sd.received_date AS "receivedDate",
              sd.notes, sd.created_at AS "createdAt", sd.uploaded_by_id AS "uploadedById", u.name AS "uploadedByName"
       FROM staff_documents sd LEFT JOIN users u ON sd.uploaded_by_id = u.id
       WHERE sd.user_id = :userId ORDER BY sd.created_at DESC`,
      { replacements: { userId: targetId }, type: QueryTypes.SELECT }
    );
    return docs;
  }

  static async createDocument(targetId: number, actorId: number, data: { name: string; documentType?: string; receivedDate?: string; notes?: string }) {
    const doc = await StaffDocument.create({
      userId: targetId,
      name: data.name.trim(),
      documentType: data.documentType || "other",
      receivedDate: data.receivedDate || null,
      notes: data.notes || null,
      uploadedById: actorId,
    });
    const uploader = await User.findByPk(actorId, { attributes: ["name"] });
    return { ...doc.get({ plain: true }), uploadedByName: uploader?.name ?? null };
  }

  static async deleteDocument(docId: number) {
    await StaffDocument.destroy({ where: { id: docId } });
  }

  static async getBeneficiaries(targetId: number) {
    return StaffBeneficiary.findAll({ where: { userId: targetId }, order: [["orderIndex", "ASC"]] });
  }

  static async createBeneficiary(targetId: number, data: { name: string; address?: string; phoneNumber?: string; orderIndex?: number }) {
    return StaffBeneficiary.create({
      userId: targetId, name: data.name.trim(),
      address: data.address || null, phoneNumber: data.phoneNumber || null,
      orderIndex: data.orderIndex ?? 0,
    });
  }

  static async updateBeneficiary(rowId: number, data: { name?: string; address?: string; phoneNumber?: string; orderIndex?: number }) {
    const updates: Record<string, any> = {};
    if (data.name?.trim()) updates.name = data.name.trim();
    if (data.address !== undefined) updates.address = data.address ?? null;
    if (data.phoneNumber !== undefined) updates.phoneNumber = data.phoneNumber ?? null;
    if (data.orderIndex !== undefined) updates.orderIndex = data.orderIndex;
    const [, rows] = await StaffBeneficiary.update(updates, { where: { id: rowId }, returning: true });
    return rows[0];
  }

  static async deleteBeneficiary(rowId: number) {
    await StaffBeneficiary.destroy({ where: { id: rowId } });
  }

  static async getWorkExperience(targetId: number) {
    return StaffWorkExperience.findAll({ where: { userId: targetId }, order: [["orderIndex", "ASC"]] });
  }

  static async createWorkExperience(targetId: number, data: any) {
    return StaffWorkExperience.create({
      userId: targetId, companyName: data.companyName.trim(),
      companyAddress: data.companyAddress || null, positionHeld: data.positionHeld || null,
      fromDate: data.fromDate || null, toDate: data.toDate || null,
      reasonForLeaving: data.reasonForLeaving || null, orderIndex: data.orderIndex ?? 0,
    });
  }

  static async updateWorkExperience(rowId: number, data: any) {
    const updates: Record<string, any> = {};
    if (data.companyName?.trim()) updates.companyName = data.companyName.trim();
    if (data.companyAddress !== undefined) updates.companyAddress = data.companyAddress ?? null;
    if (data.positionHeld !== undefined) updates.positionHeld = data.positionHeld ?? null;
    if (data.fromDate !== undefined) updates.fromDate = data.fromDate ?? null;
    if (data.toDate !== undefined) updates.toDate = data.toDate ?? null;
    if (data.reasonForLeaving !== undefined) updates.reasonForLeaving = data.reasonForLeaving ?? null;
    if (data.orderIndex !== undefined) updates.orderIndex = data.orderIndex;
    const [, rows] = await StaffWorkExperience.update(updates, { where: { id: rowId }, returning: true });
    return rows[0];
  }

  static async deleteWorkExperience(rowId: number) {
    await StaffWorkExperience.destroy({ where: { id: rowId } });
  }

  static async getEducation(targetId: number) {
    return StaffEducation.findAll({ where: { userId: targetId }, order: [["orderIndex", "ASC"]] });
  }

  static async createEducation(targetId: number, data: any) {
    return StaffEducation.create({
      userId: targetId, schoolAttended: data.schoolAttended.trim(),
      certificateObtained: data.certificateObtained || null,
      fromDate: data.fromDate || null, toDate: data.toDate || null,
      orderIndex: data.orderIndex ?? 0,
    });
  }

  static async updateEducation(rowId: number, data: any) {
    const updates: Record<string, any> = {};
    if (data.schoolAttended?.trim()) updates.schoolAttended = data.schoolAttended.trim();
    if (data.certificateObtained !== undefined) updates.certificateObtained = data.certificateObtained ?? null;
    if (data.fromDate !== undefined) updates.fromDate = data.fromDate ?? null;
    if (data.toDate !== undefined) updates.toDate = data.toDate ?? null;
    if (data.orderIndex !== undefined) updates.orderIndex = data.orderIndex;
    const [, rows] = await StaffEducation.update(updates, { where: { id: rowId }, returning: true });
    return rows[0];
  }

  static async deleteEducation(rowId: number) {
    await StaffEducation.destroy({ where: { id: rowId } });
  }

  static async getReferences(targetId: number) {
    return StaffReference.findAll({ where: { userId: targetId }, order: [["refNumber", "ASC"]] });
  }

  static async updateReferences(targetId: number, references: any[]) {
    await StaffReference.destroy({ where: { userId: targetId } });
    if (references.length > 0) {
      await StaffReference.bulkCreate(
        references.map((r: any, i: number) => ({
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
    return StaffReference.findAll({ where: { userId: targetId }, order: [["refNumber", "ASC"]] });
  }

  static async bulkImport(rows: any[], actorRole: string) {
    const allSites = await Site.findAll();
    const siteMap = new Map<string, number>(allSites.map((s: Site) => [s.name.toLowerCase().trim(), s.id]));

    const results: { row: number; status: string; name?: string; email?: string; error?: string }[] = [];
    const defaultPassword = await bcrypt.hash("changeme123", 10);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      try {
        const fullName = r.name?.trim() || [r.firstName, r.middleName, r.surname].filter(Boolean).map((s: string) => s.trim()).join(" ");
        if (!fullName || !r.email) {
          results.push({ row: rowNum, status: "error", name: fullName || r.name, email: r.email, error: "Name (or surname + firstName) and email are required" });
          continue;
        }

        let siteId: number | null = null;
        if (r.siteId) {
          siteId = Number(r.siteId);
        } else if (r.site) {
          siteId = siteMap.get(r.site.toLowerCase().trim()) ?? null;
        }
        if (!siteId) {
          results.push({ row: rowNum, status: "error", name: r.name, email: r.email, error: `Site "${r.site || r.siteId}" not found. Please create the site first or use a valid site name.` });
          continue;
        }

        const role = r.role && ["employee", "manager", "admin", "super_admin"].includes(r.role) ? r.role : "employee";
        if (!canAssignRole(actorRole, role)) {
          results.push({ row: rowNum, status: "error", name: r.name, email: r.email, error: "Insufficient permissions to assign this role" });
          continue;
        }

        const passwordHash = r.password ? await bcrypt.hash(r.password, 10) : defaultPassword;

        await User.create({
          name: fullName,
          email: r.email.trim().toLowerCase(),
          passwordHash,
          role,
          siteId,
          surname: r.surname?.trim() || null,
          firstName: r.firstName?.trim() || null,
          middleName: r.middleName?.trim() || null,
          department: r.department?.trim() || null,
          jobTitle: r.jobTitle?.trim() || null,
          phone: r.phone?.trim() || null,
          staffId: r.staffId?.trim() || null,
          gender: r.gender?.trim() || null,
          dateOfBirth: r.dateOfBirth || null,
          startDate: r.startDate || null,
          address: r.address?.trim() || null,
          city: r.city?.trim() || null,
          stateProvince: r.stateProvince?.trim() || null,
          country: r.country?.trim() || null,
          nationality: r.nationality?.trim() || null,
          nationalId: r.nationalId?.trim() || null,
          maritalStatus: r.maritalStatus?.trim() || null,
          bankName: r.bankName?.trim() || null,
          bankAccountName: r.bankAccountName?.trim() || null,
          bankAccountNumber: r.bankAccountNumber?.trim() || null,
          bankBranch: r.bankBranch?.trim() || null,
          emergencyContactName: r.emergencyContactName?.trim() || null,
          emergencyContactPhone: r.emergencyContactPhone?.trim() || null,
          emergencyContactRelation: r.emergencyContactRelation?.trim() || null,
        });

        results.push({ row: rowNum, status: "success", name: fullName, email: r.email });
      } catch (err: any) {
        const msg = err.original?.code === "23505" ? "Email already exists" : (err.message || "Unknown error");
        results.push({ row: rowNum, status: "error", name: r.name, email: r.email, error: msg });
      }
    }

    const succeeded = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "error").length;
    return { total: rows.length, succeeded, failed, results };
  }
}
