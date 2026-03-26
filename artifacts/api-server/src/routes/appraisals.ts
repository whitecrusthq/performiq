import { Router } from "express";
import { db, appraisalsTable, appraisalScoresTable, usersTable, cyclesTable, criteriaTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

async function enrichAppraisal(appraisal: typeof appraisalsTable.$inferSelect) {
  const [employee] = await db.select().from(usersTable).where(eq(usersTable.id, appraisal.employeeId)).limit(1);
  const [cycle] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, appraisal.cycleId)).limit(1);
  let reviewer = null;
  if (appraisal.reviewerId) {
    const [r] = await db.select().from(usersTable).where(eq(usersTable.id, appraisal.reviewerId)).limit(1);
    reviewer = r ? { id: r.id, name: r.name, email: r.email, role: r.role, managerId: r.managerId, department: r.department, jobTitle: r.jobTitle, createdAt: r.createdAt } : null;
  }
  const formatUser = (u: typeof usersTable.$inferSelect) => ({ id: u.id, name: u.name, email: u.email, role: u.role, managerId: u.managerId, department: u.department, jobTitle: u.jobTitle, createdAt: u.createdAt });
  return {
    ...appraisal,
    employee: formatUser(employee),
    reviewer,
    cycle,
  };
}

router.get("/appraisals", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { cycleId, employeeId } = req.query;
    let query = db.select().from(appraisalsTable);
    const conditions = [];
    if (cycleId) conditions.push(eq(appraisalsTable.cycleId, Number(cycleId)));
    if (employeeId) conditions.push(eq(appraisalsTable.employeeId, Number(employeeId)));

    if (req.user!.role === "employee") {
      conditions.push(eq(appraisalsTable.employeeId, req.user!.id));
    } else if (req.user!.role === "manager") {
      const teamMembers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, req.user!.id));
      const memberIds = teamMembers.map(m => m.id);
      if (memberIds.length > 0) {
        conditions.push(inArray(appraisalsTable.employeeId, memberIds));
      } else {
        res.json([]); return;
      }
    }

    const appraisals = conditions.length > 0
      ? await db.select().from(appraisalsTable).where(and(...conditions)).orderBy(appraisalsTable.createdAt)
      : await db.select().from(appraisalsTable).orderBy(appraisalsTable.createdAt);

    const enriched = await Promise.all(appraisals.map(enrichAppraisal));
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Determine next status based on current status + workflow type
function nextStatus(current: string, workflowType: string): string | null {
  if (current === "self_review") {
    if (workflowType === "self_only") return "completed";
    return "manager_review";
  }
  if (current === "manager_review") {
    if (workflowType === "admin_approval") return "pending_approval";
    return "completed";
  }
  if (current === "pending_approval") return "completed";
  return null;
}

router.post("/appraisals", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!["admin", "manager"].includes(req.user!.role)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const { cycleId, employeeId, reviewerId, workflowType } = req.body;
    const [appraisal] = await db.insert(appraisalsTable)
      .values({ cycleId, employeeId, reviewerId: reviewerId ?? req.user!.id, workflowType: workflowType ?? "admin_approval", status: "self_review" })
      .returning();

    const criteria = await db.select().from(criteriaTable);
    if (criteria.length > 0) {
      await db.insert(appraisalScoresTable).values(
        criteria.map(c => ({ appraisalId: appraisal.id, criterionId: c.id }))
      );
    }

    const enriched = await enrichAppraisal(appraisal);
    res.status(201).json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/appraisals/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [appraisal] = await db.select().from(appraisalsTable).where(eq(appraisalsTable.id, Number(req.params.id))).limit(1);
    if (!appraisal) { res.status(404).json({ error: "Not found" }); return; }

    const scores = await db.select().from(appraisalScoresTable).where(eq(appraisalScoresTable.appraisalId, appraisal.id));
    const enrichedScores = await Promise.all(scores.map(async s => {
      const [criterion] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, s.criterionId)).limit(1);
      return { ...s, criterion };
    }));

    const enriched = await enrichAppraisal(appraisal);
    res.json({ ...enriched, scores: enrichedScores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/appraisals/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { action, selfComment, managerComment, scores } = req.body;

    // Fetch the current appraisal to determine workflow routing
    const [current] = await db.select().from(appraisalsTable).where(eq(appraisalsTable.id, Number(req.params.id))).limit(1);
    if (!current) { res.status(404).json({ error: "Not found" }); return; }

    const updates: Partial<typeof appraisalsTable.$inferInsert> = {};

    // Route to next status dynamically if submitting
    if (action === "submit") {
      const next = nextStatus(current.status, current.workflowType);
      if (next) updates.status = next as any;
    } else if (action === "save") {
      // keep status as-is (draft save)
    }

    if (selfComment !== undefined) updates.selfComment = selfComment;
    if (managerComment !== undefined) updates.managerComment = managerComment;

    if (scores && Array.isArray(scores)) {
      for (const score of scores) {
        const existing = await db.select().from(appraisalScoresTable)
          .where(and(eq(appraisalScoresTable.appraisalId, Number(req.params.id)), eq(appraisalScoresTable.criterionId, score.criterionId)))
          .limit(1);
        if (existing.length > 0) {
          await db.update(appraisalScoresTable)
            .set({ selfScore: score.selfScore, managerScore: score.managerScore, selfNote: score.selfNote, managerNote: score.managerNote })
            .where(eq(appraisalScoresTable.id, existing[0].id));
        }
      }
      // Calculate overall score from manager scores when reaching pending_approval or completed
      const targetStatus = updates.status ?? current.status;
      if (targetStatus === "pending_approval" || targetStatus === "completed") {
        const allScores = await db.select().from(appraisalScoresTable).where(eq(appraisalScoresTable.appraisalId, Number(req.params.id)));
        const mgScores = allScores.filter(s => s.managerScore != null).map(s => Number(s.managerScore));
        if (mgScores.length > 0) {
          updates.overallScore = String(mgScores.reduce((a, b) => a + b, 0) / mgScores.length);
        }
      }
    }

    // Admin approving from pending_approval (no scores submitted)
    if (action === "submit" && current.status === "pending_approval" && !scores) {
      const allScores = await db.select().from(appraisalScoresTable).where(eq(appraisalScoresTable.appraisalId, Number(req.params.id)));
      const mgScores = allScores.filter(s => s.managerScore != null).map(s => Number(s.managerScore));
      if (mgScores.length > 0 && !current.overallScore) {
        updates.overallScore = String(mgScores.reduce((a, b) => a + b, 0) / mgScores.length);
      }
    }

    const [updated] = await db.update(appraisalsTable).set(updates).where(eq(appraisalsTable.id, Number(req.params.id))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    const allScores = await db.select().from(appraisalScoresTable).where(eq(appraisalScoresTable.appraisalId, updated.id));
    const enrichedScores = await Promise.all(allScores.map(async s => {
      const [criterion] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, s.criterionId)).limit(1);
      return { ...s, criterion };
    }));

    const enriched = await enrichAppraisal(updated);
    res.json({ ...enriched, scores: enrichedScores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
