import { Router } from "express";
import { db, appraisalsTable, appraisalScoresTable, appraisalReviewersTable, appraisalReviewerScoresTable, usersTable, cyclesTable, criteriaTable, criteriaGroupItemsTable } from "../db/index.js";
import { eq, and, inArray, or, asc } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";

const router = Router();

const formatUser = (u: typeof usersTable.$inferSelect | undefined | null) => u ? ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  managerId: u.managerId, department: u.department, jobTitle: u.jobTitle, createdAt: u.createdAt,
}) : null;

async function getReviewersForAppraisal(appraisalId: number) {
  const rows = await db.select().from(appraisalReviewersTable)
    .where(eq(appraisalReviewersTable.appraisalId, appraisalId))
    .orderBy(asc(appraisalReviewersTable.orderIndex));
  if (rows.length === 0) return [];
  const reviewerUsers = await db.select().from(usersTable).where(inArray(usersTable.id, rows.map(r => r.reviewerId)));
  const userMap = Object.fromEntries(reviewerUsers.map(u => [u.id, u]));
  return rows.map(row => ({
    ...(formatUser(userMap[row.reviewerId]) ?? { id: row.reviewerId, name: 'Unknown', email: '', role: 'employee', managerId: null, department: null, jobTitle: null, createdAt: null }),
    stepStatus: row.status,
    orderIndex: row.orderIndex,
    managerComment: row.managerComment,
    reviewedAt: row.reviewedAt,
  }));
}

async function getReviewerScoresForAppraisal(appraisalId: number) {
  const reviewerScoreRows = await db.select().from(appraisalReviewerScoresTable)
    .where(eq(appraisalReviewerScoresTable.appraisalId, appraisalId));
  const reviewerIds = [...new Set(reviewerScoreRows.map(r => r.reviewerId))];
  const reviewerUsers = reviewerIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, reviewerIds))
    : [];
  const reviewerUserMap = Object.fromEntries(reviewerUsers.map(u => [u.id, u]));

  const junctionRows = await db.select().from(appraisalReviewersTable)
    .where(eq(appraisalReviewersTable.appraisalId, appraisalId))
    .orderBy(asc(appraisalReviewersTable.orderIndex));

  return reviewerIds.map(rid => {
    const user = reviewerUserMap[rid];
    const junction = junctionRows.find(r => r.reviewerId === rid);
    return {
      reviewerId: rid,
      reviewerName: user?.name ?? `Reviewer ${rid}`,
      reviewerRole: user?.role,
      comment: junction?.managerComment ?? null,
      reviewedAt: junction?.reviewedAt ?? null,
      stepStatus: junction?.status ?? null,
      orderIndex: junction?.orderIndex ?? 0,
      scores: reviewerScoreRows
        .filter(r => r.reviewerId === rid)
        .map(r => ({ criterionId: r.criterionId, score: r.score, note: r.note, actualValue: r.actualValue })),
    };
  }).sort((a, b) => a.orderIndex - b.orderIndex);
}

async function enrichAppraisal(appraisal: typeof appraisalsTable.$inferSelect) {
  const [employee] = await db.select().from(usersTable).where(eq(usersTable.id, appraisal.employeeId)).limit(1);
  const [cycle] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, appraisal.cycleId)).limit(1);
  const reviewers = await getReviewersForAppraisal(appraisal.id);
  const currentReviewer = reviewers.find(r => r.stepStatus === 'in_progress') ?? reviewers.find(r => r.stepStatus === 'pending') ?? null;
  const reviewer = currentReviewer ?? (reviewers.length > 0 ? reviewers[0] : null);

  return {
    ...appraisal,
    employee: formatUser(employee),
    reviewer,
    reviewers,
    cycle,
  };
}

// When appraisal transitions to manager_review, activate first pending reviewer
async function activateNextReviewer(appraisalId: number): Promise<boolean> {
  const rows = await db.select().from(appraisalReviewersTable)
    .where(and(eq(appraisalReviewersTable.appraisalId, appraisalId), eq(appraisalReviewersTable.status, 'pending')))
    .orderBy(asc(appraisalReviewersTable.orderIndex))
    .limit(1);
  if (rows.length === 0) return false; // no more pending reviewers
  await db.update(appraisalReviewersTable)
    .set({ status: 'in_progress' })
    .where(eq(appraisalReviewersTable.id, rows[0].id));
  return true;
}

router.get("/appraisals", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { cycleId, employeeId } = req.query;
    const conditions = [];
    if (cycleId) conditions.push(eq(appraisalsTable.cycleId, Number(cycleId)));
    if (employeeId) conditions.push(eq(appraisalsTable.employeeId, Number(employeeId)));

    if (req.user!.role === "employee") {
      conditions.push(eq(appraisalsTable.employeeId, req.user!.id));
    } else if (req.user!.role === "manager") {
      const teamMembers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, req.user!.id));
      const memberIds = teamMembers.map(m => m.id);
      const reviewerRows = await db.select({ appraisalId: appraisalReviewersTable.appraisalId })
        .from(appraisalReviewersTable).where(eq(appraisalReviewersTable.reviewerId, req.user!.id));
      const reviewerAppraisalIds = reviewerRows.map(r => r.appraisalId);
      const orConditions = [];
      if (memberIds.length > 0) orConditions.push(inArray(appraisalsTable.employeeId, memberIds));
      if (reviewerAppraisalIds.length > 0) orConditions.push(inArray(appraisalsTable.id, reviewerAppraisalIds));
      if (orConditions.length > 0) conditions.push(or(...orConditions)!);
      else conditions.push(eq(appraisalsTable.employeeId, -1));
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

type AppraisalStatusValue = "pending" | "self_review" | "manager_review" | "pending_approval" | "completed";

function nextAppraisalStatus(current: string, workflowType: string, allReviewersDone: boolean): AppraisalStatusValue | null {
  if (current === "self_review") return "manager_review";
  if (current === "manager_review") {
    if (!allReviewersDone) return null; // stay in manager_review, still more reviewers
    if (workflowType === "admin_approval") return "pending_approval";
    return "completed";
  }
  if (current === "pending_approval") return "completed";
  return null;
}

router.post("/appraisals", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!["admin", "super_admin", "manager"].includes(req.user!.role)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const { cycleId, employeeId, reviewerIds, workflowType } = req.body;
    const orderedIds: number[] = Array.isArray(reviewerIds) && reviewerIds.length > 0
      ? reviewerIds.map(Number)
      : (req.user!.role !== "employee" ? [req.user!.id] : []);

    const { criteriaGroupId } = req.body;

    const [appraisal] = await db.insert(appraisalsTable)
      .values({
        cycleId,
        employeeId,
        reviewerId: orderedIds[0] ?? null,
        workflowType: workflowType ?? "admin_approval",
        status: "self_review",
        criteriaGroupId: criteriaGroupId ? Number(criteriaGroupId) : null,
      })
      .returning();

    if (orderedIds.length > 0) {
      await db.insert(appraisalReviewersTable).values(
        orderedIds.map((rid, idx) => ({
          appraisalId: appraisal.id,
          reviewerId: rid,
          orderIndex: idx,
          status: 'pending',
        }))
      ).onConflictDoNothing();
    }

    // If a criteria group is specified, only score criteria in that group; otherwise all criteria
    let criteriaToScore = await db.select().from(criteriaTable);
    if (criteriaGroupId) {
      const groupItems = await db.select().from(criteriaGroupItemsTable)
        .where(eq(criteriaGroupItemsTable.groupId, Number(criteriaGroupId)));
      const groupCriterionIds = new Set(groupItems.map(i => i.criterionId));
      criteriaToScore = criteriaToScore.filter(c => groupCriterionIds.has(c.id));
    }

    const { budgetValues } = req.body;
    const budgetMap: Record<number, number> = {};
    if (budgetValues && typeof budgetValues === 'object') {
      for (const [k, v] of Object.entries(budgetValues)) {
        budgetMap[Number(k)] = Number(v);
      }
    }

    if (criteriaToScore.length > 0) {
      await db.insert(appraisalScoresTable).values(
        criteriaToScore.map(c => ({
          appraisalId: appraisal.id,
          criterionId: c.id,
          budgetValue: budgetMap[c.id] != null ? String(budgetMap[c.id]) : null,
        }))
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

    const [enriched, reviewerScores] = await Promise.all([
      enrichAppraisal(appraisal),
      getReviewerScoresForAppraisal(appraisal.id),
    ]);
    res.json({ ...enriched, scores: enrichedScores, reviewerScores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/appraisals/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { action, selfComment, managerComment, scores } = req.body;
    const appraisalId = Number(req.params.id);

    const [current] = await db.select().from(appraisalsTable).where(eq(appraisalsTable.id, appraisalId)).limit(1);
    if (!current) { res.status(404).json({ error: "Not found" }); return; }

    const updates: Partial<typeof appraisalsTable.$inferInsert> = {};

    if (action === "resend_review") {
      if (!["admin", "super_admin", "manager"].includes(req.user!.role)) {
        res.status(403).json({ error: "Only admins/managers can resend for review" }); return;
      }
      if (req.user!.role === "manager") {
        const isReviewer = await db.select().from(appraisalReviewersTable)
          .where(and(eq(appraisalReviewersTable.appraisalId, appraisalId), eq(appraisalReviewersTable.reviewerId, req.user!.id)))
          .limit(1);
        const teamMembers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, req.user!.id));
        const isManager = teamMembers.some(m => m.id === current.employeeId);
        if (isReviewer.length === 0 && !isManager) {
          res.status(403).json({ error: "You can only resend appraisals for your team members or reviews assigned to you" }); return;
        }
      }
      await db.update(appraisalReviewersTable)
        .set({ status: 'pending', managerComment: null, reviewedAt: null })
        .where(eq(appraisalReviewersTable.appraisalId, appraisalId));
      await db.delete(appraisalReviewerScoresTable)
        .where(eq(appraisalReviewerScoresTable.appraisalId, appraisalId));
      updates.status = "self_review";
      updates.overallScore = null;
      updates.managerComment = null;

      const { budgetValues: resendBudgets } = req.body;
      if (resendBudgets && typeof resendBudgets === 'object') {
        for (const [critIdStr, val] of Object.entries(resendBudgets)) {
          await db.update(appraisalScoresTable)
            .set({ budgetValue: val != null ? String(val) : null, managerScore: null, managerNote: null })
            .where(and(eq(appraisalScoresTable.appraisalId, appraisalId), eq(appraisalScoresTable.criterionId, Number(critIdStr))));
        }
      }
    }

    if (action === "update_budgets") {
      if (!["admin", "super_admin", "manager"].includes(req.user!.role)) {
        res.status(403).json({ error: "Only admins/managers can update budget values" }); return;
      }
      if (req.user!.role === "manager") {
        const isReviewer = await db.select().from(appraisalReviewersTable)
          .where(and(eq(appraisalReviewersTable.appraisalId, appraisalId), eq(appraisalReviewersTable.reviewerId, req.user!.id)))
          .limit(1);
        const teamMembers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, req.user!.id));
        const isManager = teamMembers.some(m => m.id === current.employeeId);
        if (isReviewer.length === 0 && !isManager) {
          res.status(403).json({ error: "You can only update budgets for your team members or reviews assigned to you" }); return;
        }
      }
      const { budgetValues: budgetUpdates } = req.body;
      if (budgetUpdates && typeof budgetUpdates === 'object') {
        for (const [critIdStr, val] of Object.entries(budgetUpdates)) {
          await db.update(appraisalScoresTable)
            .set({ budgetValue: val != null ? String(val) : null })
            .where(and(eq(appraisalScoresTable.appraisalId, appraisalId), eq(appraisalScoresTable.criterionId, Number(critIdStr))));
        }
      }
    }

    if (action === "submit") {
      if (current.status === "self_review") {
        // Move to manager_review and activate first reviewer
        updates.status = "manager_review";
      } else if (current.status === "manager_review") {
        // Mark current in_progress reviewer as completed
        const [inProgressRow] = await db.select().from(appraisalReviewersTable)
          .where(and(eq(appraisalReviewersTable.appraisalId, appraisalId), eq(appraisalReviewersTable.status, 'in_progress')))
          .limit(1);

        if (inProgressRow) {
          await db.update(appraisalReviewersTable)
            .set({ status: 'completed', managerComment: managerComment || null, reviewedAt: new Date() })
            .where(eq(appraisalReviewersTable.id, inProgressRow.id));
        }

        // Try to activate next reviewer
        const hasNext = await activateNextReviewer(appraisalId);
        if (!hasNext) {
          // All reviewers done — advance appraisal status
          const next = nextAppraisalStatus(current.status, current.workflowType, true);
          if (next) updates.status = next;
        }
        // If hasNext, stay in manager_review for the next reviewer
      } else if (current.status === "pending_approval") {
        updates.status = "completed";
      }
    }

    if (selfComment !== undefined) updates.selfComment = selfComment;
    // managerComment is stored per-reviewer in the junction table, not on the appraisal
    // But we still store last manager comment on appraisal for backward compat
    if (managerComment !== undefined && current.status === "manager_review") {
      updates.managerComment = managerComment;
    }

    // Find current in-progress reviewer (if this is a manager/reviewer action)
    const [inProgressReviewerRow] = current.status === "manager_review"
      ? await db.select().from(appraisalReviewersTable)
          .where(and(eq(appraisalReviewersTable.appraisalId, appraisalId), eq(appraisalReviewersTable.status, 'in_progress')))
          .limit(1)
      : [undefined];
    const currentReviewerId = inProgressReviewerRow?.reviewerId ?? req.user!.id;

    if (scores && Array.isArray(scores)) {
      for (const score of scores) {
        const existing = await db.select().from(appraisalScoresTable)
          .where(and(eq(appraisalScoresTable.appraisalId, appraisalId), eq(appraisalScoresTable.criterionId, score.criterionId)))
          .limit(1);
        if (existing.length > 0) {
          await db.update(appraisalScoresTable)
            .set({
              selfScore: score.selfScore,
              managerScore: score.managerScore,
              selfNote: score.selfNote,
              managerNote: score.managerNote,
              actualValue: score.actualValue ?? existing[0].actualValue,
            })
            .where(eq(appraisalScoresTable.id, existing[0].id));
        }

        // Save per-reviewer scores when in manager_review
        if (current.status === "manager_review" && score.managerScore != null) {
          const existingRevScore = await db.select().from(appraisalReviewerScoresTable)
            .where(and(
              eq(appraisalReviewerScoresTable.appraisalId, appraisalId),
              eq(appraisalReviewerScoresTable.reviewerId, currentReviewerId),
              eq(appraisalReviewerScoresTable.criterionId, score.criterionId),
            )).limit(1);
          if (existingRevScore.length > 0) {
            await db.update(appraisalReviewerScoresTable)
              .set({ score: score.managerScore, note: score.managerNote, actualValue: score.actualValue ?? null })
              .where(eq(appraisalReviewerScoresTable.id, existingRevScore[0].id));
          } else {
            await db.insert(appraisalReviewerScoresTable).values({
              appraisalId: appraisalId,
              reviewerId: currentReviewerId,
              criterionId: score.criterionId,
              score: score.managerScore,
              note: score.managerNote,
              actualValue: score.actualValue ?? null,
            });
          }
        }
      }
      const targetStatus = updates.status ?? current.status;
      if (targetStatus === "pending_approval" || targetStatus === "completed") {
        const allScores = await db.select().from(appraisalScoresTable).where(eq(appraisalScoresTable.appraisalId, appraisalId));
        const mgScores = allScores.filter(s => s.managerScore != null).map(s => Number(s.managerScore));
        if (mgScores.length > 0) {
          updates.overallScore = String(mgScores.reduce((a, b) => a + b, 0) / mgScores.length);
        }
      }
    }

    if (action === "submit" && current.status === "pending_approval" && !scores) {
      const allScores = await db.select().from(appraisalScoresTable).where(eq(appraisalScoresTable.appraisalId, appraisalId));
      const mgScores = allScores.filter(s => s.managerScore != null).map(s => Number(s.managerScore));
      if (mgScores.length > 0 && !current.overallScore) {
        updates.overallScore = String(mgScores.reduce((a, b) => a + b, 0) / mgScores.length);
      }
    }

    // If transitioning to manager_review, activate first reviewer
    if (updates.status === "manager_review") {
      await activateNextReviewer(appraisalId);
    }

    const [updated] = await db.update(appraisalsTable).set(updates).where(eq(appraisalsTable.id, appraisalId)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    const allScores = await db.select().from(appraisalScoresTable).where(eq(appraisalScoresTable.appraisalId, updated.id));
    const enrichedScores = await Promise.all(allScores.map(async s => {
      const [criterion] = await db.select().from(criteriaTable).where(eq(criteriaTable.id, s.criterionId)).limit(1);
      return { ...s, criterion };
    }));

    const [enriched, reviewerScores] = await Promise.all([
      enrichAppraisal(updated),
      getReviewerScoresForAppraisal(updated.id),
    ]);
    res.json({ ...enriched, scores: enrichedScores, reviewerScores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add a reviewer to an existing appraisal
router.post("/appraisals/:id/reviewers", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { reviewerId } = req.body;
    if (!reviewerId) { res.status(400).json({ error: "reviewerId required" }); return; }
    const [appraisal] = await db.select().from(appraisalsTable).where(eq(appraisalsTable.id, Number(req.params.id))).limit(1);
    if (!appraisal) { res.status(404).json({ error: "Not found" }); return; }

    const existing = await getReviewersForAppraisal(appraisal.id);
    const nextOrder = existing.length;

    await db.insert(appraisalReviewersTable)
      .values({ appraisalId: appraisal.id, reviewerId: Number(reviewerId), orderIndex: nextOrder, status: 'pending' })
      .onConflictDoNothing();

    if (!appraisal.reviewerId) {
      await db.update(appraisalsTable).set({ reviewerId: Number(reviewerId) }).where(eq(appraisalsTable.id, appraisal.id));
    }

    const reviewers = await getReviewersForAppraisal(appraisal.id);
    res.json({ reviewers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete an appraisal entirely (admin only)
router.delete("/appraisals/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(appraisalReviewersTable).where(eq(appraisalReviewersTable.appraisalId, id));
    await db.delete(appraisalReviewerScoresTable).where(eq(appraisalReviewerScoresTable.appraisalId, id));
    await db.delete(appraisalScoresTable).where(eq(appraisalScoresTable.appraisalId, id));
    await db.delete(appraisalsTable).where(eq(appraisalsTable.id, id));
    res.json({ message: "Appraisal deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Remove a reviewer from an existing appraisal
router.delete("/appraisals/:id/reviewers/:reviewerId", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    await db.delete(appraisalReviewersTable)
      .where(and(
        eq(appraisalReviewersTable.appraisalId, Number(req.params.id)),
        eq(appraisalReviewersTable.reviewerId, Number(req.params.reviewerId))
      ));
    const remaining = await getReviewersForAppraisal(Number(req.params.id));
    // Re-index order
    for (let i = 0; i < remaining.length; i++) {
      await db.update(appraisalReviewersTable)
        .set({ orderIndex: i })
        .where(and(eq(appraisalReviewersTable.appraisalId, Number(req.params.id)), eq(appraisalReviewersTable.reviewerId, remaining[i].id)));
    }
    await db.update(appraisalsTable)
      .set({ reviewerId: remaining.length > 0 ? remaining[0].id : null })
      .where(eq(appraisalsTable.id, Number(req.params.id)));
    res.json({ reviewers: await getReviewersForAppraisal(Number(req.params.id)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
