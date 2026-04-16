import { Router } from "express";
import { db, disciplinaryRecordsTable, disciplinaryAttachmentsTable, usersTable } from "../db/index.js";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/users/:userId/disciplinary", requireAuth, requireRole(["admin", "super_admin"]), async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.userId);
    const records = await db.select().from(disciplinaryRecordsTable)
      .where(eq(disciplinaryRecordsTable.userId, userId))
      .orderBy(desc(disciplinaryRecordsTable.createdAt));

    const recordIds = records.map(r => r.id);
    let attachments: any[] = [];
    if (recordIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      attachments = await db.select().from(disciplinaryAttachmentsTable)
        .where(inArray(disciplinaryAttachmentsTable.recordId, recordIds));
    }

    const creatorIds = [...new Set(records.map(r => r.createdById).filter(Boolean))] as number[];
    let creators: any[] = [];
    if (creatorIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      creators = await db.select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable).where(inArray(usersTable.id, creatorIds));
    }
    const creatorMap = Object.fromEntries(creators.map(c => [c.id, c.name]));

    const result = records.map(r => ({
      ...r,
      createdByName: r.createdById ? creatorMap[r.createdById] || null : null,
      attachments: attachments.filter(a => a.recordId === r.id),
    }));

    res.json(result);
  } catch (err) {
    console.error("GET disciplinary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/users/:userId/disciplinary", requireAuth, requireRole(["admin", "super_admin"]), async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.userId);
    const { type, subject, description, sanctionApplied, severity, incidentDate, attachments } = req.body;

    if (!subject?.trim()) return res.status(400).json({ error: "Subject is required" });

    const [record] = await db.insert(disciplinaryRecordsTable).values({
      userId,
      type: type || "disciplinary",
      subject: subject.trim(),
      description: description?.trim() || null,
      sanctionApplied: sanctionApplied?.trim() || null,
      severity: severity || "minor",
      incidentDate: incidentDate || null,
      createdById: req.user!.id,
    }).returning();

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      await db.insert(disciplinaryAttachmentsTable).values(
        attachments.map((a: any) => ({
          recordId: record.id,
          fileName: a.fileName,
          fileType: a.fileType || "application/octet-stream",
          objectPath: a.objectPath,
          uploadedById: req.user!.id,
        }))
      );
    }

    const allAttachments = await db.select().from(disciplinaryAttachmentsTable)
      .where(eq(disciplinaryAttachmentsTable.recordId, record.id));

    res.status(201).json({
      ...record,
      createdByName: req.user!.name,
      attachments: allAttachments,
    });
  } catch (err) {
    console.error("POST disciplinary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/users/:userId/disciplinary/:id", requireAuth, requireRole(["admin", "super_admin"]), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { type, subject, description, sanctionApplied, severity, incidentDate } = req.body;

    const [updated] = await db.update(disciplinaryRecordsTable)
      .set({
        type: type || "disciplinary",
        subject: subject?.trim(),
        description: description?.trim() || null,
        sanctionApplied: sanctionApplied?.trim() || null,
        severity: severity || "minor",
        incidentDate: incidentDate || null,
        updatedAt: new Date(),
      })
      .where(eq(disciplinaryRecordsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Record not found" });
    res.json(updated);
  } catch (err) {
    console.error("PUT disciplinary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/users/:userId/disciplinary/:id", requireAuth, requireRole(["admin", "super_admin"]), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(disciplinaryRecordsTable).where(eq(disciplinaryRecordsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE disciplinary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/users/:userId/disciplinary/:id/attachments", requireAuth, requireRole(["admin", "super_admin"]), async (req: AuthRequest, res) => {
  try {
    const recordId = Number(req.params.id);
    const { fileName, fileType, objectPath } = req.body;
    if (!fileName || !objectPath) return res.status(400).json({ error: "fileName and objectPath are required" });

    const [attachment] = await db.insert(disciplinaryAttachmentsTable).values({
      recordId,
      fileName,
      fileType: fileType || "application/octet-stream",
      objectPath,
      uploadedById: req.user!.id,
    }).returning();

    res.status(201).json(attachment);
  } catch (err) {
    console.error("POST attachment error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/users/:userId/disciplinary/:recordId/attachments/:attachmentId", requireAuth, requireRole(["admin", "super_admin"]), async (req: AuthRequest, res) => {
  try {
    const attachmentId = Number(req.params.attachmentId);
    await db.delete(disciplinaryAttachmentsTable).where(eq(disciplinaryAttachmentsTable.id, attachmentId));
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE attachment error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
