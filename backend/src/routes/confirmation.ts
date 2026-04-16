import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { confirmationReviewsTable, usersTable, appraisalsTable } from "../db/schema/index.js";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.post("/confirmation-reviews", requireAuth, requireRole("admin", "super_admin"), async (req: AuthRequest, res) => {
  try {
    const { employeeId, notes } = req.body;
    if (!employeeId) { res.status(400).json({ error: "employeeId is required" }); return; }

    const [employee] = await db.select().from(usersTable).where(eq(usersTable.id, employeeId)).limit(1);
    if (!employee) { res.status(404).json({ error: "Employee not found" }); return; }

    const allReviews = await db.select().from(confirmationReviewsTable)
      .where(eq(confirmationReviewsTable.employeeId, employeeId));
    const activeReview = allReviews.find(r => !["completed", "rejected"].includes(r.status));
    if (activeReview) {
      res.status(409).json({ error: "A confirmation review is already in progress for this employee", review: activeReview });
      return;
    }

    const [review] = await db.insert(confirmationReviewsTable).values({
      employeeId,
      initiatedBy: req.user!.id,
      status: "pending_appraisal",
      reviewerNotes: notes || null,
    }).returning();

    res.status(201).json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/confirmation-reviews/:employeeId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const reviews = await db.select().from(confirmationReviewsTable)
      .where(eq(confirmationReviewsTable.employeeId, employeeId))
      .orderBy(desc(confirmationReviewsTable.createdAt));

    const active = reviews.find(r => !["completed", "rejected"].includes(r.status));
    let linkedAppraisal = null;
    if (active?.appraisalId) {
      const [a] = await db.select().from(appraisalsTable).where(eq(appraisalsTable.id, active.appraisalId)).limit(1);
      linkedAppraisal = a || null;
    }

    res.json({ active, history: reviews, linkedAppraisal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/confirmation-reviews/:id/link-appraisal", requireAuth, requireRole("admin", "super_admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { appraisalId } = req.body;
    if (!appraisalId) { res.status(400).json({ error: "appraisalId is required" }); return; }

    const [review] = await db.select().from(confirmationReviewsTable).where(eq(confirmationReviewsTable.id, id)).limit(1);
    if (!review) { res.status(404).json({ error: "Confirmation review not found" }); return; }
    if (review.status === "completed" || review.status === "rejected") {
      res.status(400).json({ error: "Review is already finalized" }); return;
    }

    const [appraisal] = await db.select().from(appraisalsTable).where(eq(appraisalsTable.id, appraisalId)).limit(1);
    if (!appraisal) { res.status(404).json({ error: "Appraisal not found" }); return; }
    if (appraisal.employeeId !== review.employeeId) {
      res.status(400).json({ error: "Appraisal does not belong to this employee" }); return;
    }

    const newStatus = appraisal.status === "completed"
      ? (review.reviewDocumentPath ? "pending_approval" : "pending_document")
      : "pending_appraisal";

    const [updated] = await db.update(confirmationReviewsTable)
      .set({ appraisalId, status: newStatus, updatedAt: new Date() })
      .where(eq(confirmationReviewsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/confirmation-reviews/:id/document", requireAuth, requireRole("admin", "super_admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { documentPath, documentName } = req.body;
    if (!documentPath) { res.status(400).json({ error: "documentPath is required" }); return; }

    const [review] = await db.select().from(confirmationReviewsTable).where(eq(confirmationReviewsTable.id, id)).limit(1);
    if (!review) { res.status(404).json({ error: "Confirmation review not found" }); return; }
    if (review.status === "completed" || review.status === "rejected") {
      res.status(400).json({ error: "Review is already finalized" }); return;
    }

    let newStatus = review.status;
    if (review.appraisalId) {
      const [appraisal] = await db.select().from(appraisalsTable).where(eq(appraisalsTable.id, review.appraisalId)).limit(1);
      if (appraisal && appraisal.status === "completed") {
        newStatus = "pending_approval";
      }
    }

    const [updated] = await db.update(confirmationReviewsTable)
      .set({
        reviewDocumentPath: documentPath,
        reviewDocumentName: documentName || "Review Document",
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(confirmationReviewsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/confirmation-reviews/:id/approve", requireAuth, requireRole("admin", "super_admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { notes } = req.body;

    const [review] = await db.select().from(confirmationReviewsTable).where(eq(confirmationReviewsTable.id, id)).limit(1);
    if (!review) { res.status(404).json({ error: "Confirmation review not found" }); return; }

    if (review.status === "completed") { res.status(400).json({ error: "Already completed" }); return; }
    if (review.status === "rejected") { res.status(400).json({ error: "Already rejected" }); return; }

    if (review.appraisalId) {
      const [appraisal] = await db.select().from(appraisalsTable).where(eq(appraisalsTable.id, review.appraisalId)).limit(1);
      if (!appraisal || appraisal.status !== "completed") {
        res.status(400).json({ error: "Linked appraisal must be completed before approval" }); return;
      }
    } else {
      res.status(400).json({ error: "An appraisal must be linked before approval" }); return;
    }

    if (!review.reviewDocumentPath) {
      res.status(400).json({ error: "A review document must be uploaded before approval" }); return;
    }

    const [updated] = await db.update(confirmationReviewsTable)
      .set({
        status: "completed",
        approvedBy: req.user!.id,
        reviewerNotes: notes || review.reviewerNotes,
        updatedAt: new Date(),
      })
      .where(eq(confirmationReviewsTable.id, id))
      .returning();

    await db.update(usersTable)
      .set({ probationStatus: "confirmed" })
      .where(eq(usersTable.id, review.employeeId));

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/confirmation-reviews/:id/reject", requireAuth, requireRole("admin", "super_admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;

    const [review] = await db.select().from(confirmationReviewsTable).where(eq(confirmationReviewsTable.id, id)).limit(1);
    if (!review) { res.status(404).json({ error: "Confirmation review not found" }); return; }
    if (review.status === "completed" || review.status === "rejected") {
      res.status(400).json({ error: "Review is already finalized" }); return;
    }

    const [updated] = await db.update(confirmationReviewsTable)
      .set({
        status: "rejected",
        rejectedReason: reason || null,
        approvedBy: req.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(confirmationReviewsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/confirmation-reviews/:id/refresh-status", requireAuth, requireRole("admin", "super_admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [review] = await db.select().from(confirmationReviewsTable).where(eq(confirmationReviewsTable.id, id)).limit(1);
    if (!review) { res.status(404).json({ error: "Not found" }); return; }

    if (review.appraisalId && (review.status === "pending_appraisal" || review.status === "pending_document")) {
      const [appraisal] = await db.select().from(appraisalsTable).where(eq(appraisalsTable.id, review.appraisalId)).limit(1);
      if (appraisal?.status === "completed" && review.reviewDocumentPath) {
        const [updated] = await db.update(confirmationReviewsTable)
          .set({ status: "pending_approval", updatedAt: new Date() })
          .where(eq(confirmationReviewsTable.id, id)).returning();
        res.json(updated); return;
      } else if (appraisal?.status === "completed" && !review.reviewDocumentPath) {
        const [updated] = await db.update(confirmationReviewsTable)
          .set({ status: "pending_document", updatedAt: new Date() })
          .where(eq(confirmationReviewsTable.id, id)).returning();
        res.json(updated); return;
      }
    }
    res.json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
