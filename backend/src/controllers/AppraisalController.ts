import { Op } from "sequelize";
import { Appraisal, AppraisalScore, AppraisalReviewer, AppraisalReviewerScore, User, Cycle, Criterion, CriteriaGroupItem } from "../models/index.js";
import sequelize from "../db/sequelize.js";

const formatUser = (u: any) => u ? ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  managerId: u.managerId, department: u.department, jobTitle: u.jobTitle, createdAt: u.createdAt,
}) : null;

type AppraisalStatusValue = "pending" | "scheduled" | "self_review" | "manager_review" | "pending_approval" | "completed";

function parseScheduledStart(input: any): Date | null {
  if (input == null || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function nextAppraisalStatus(current: string, workflowType: string, allReviewersDone: boolean): AppraisalStatusValue | null {
  if (current === "self_review") return "manager_review";
  if (current === "manager_review") {
    if (!allReviewersDone) return null;
    if (workflowType === "admin_approval") return "pending_approval";
    return "completed";
  }
  if (current === "pending_approval") return "completed";
  return null;
}

export default class AppraisalController {
  /**
   * Computes the overall score for an appraisal based on the cycle's scoring mode.
   * - managers_only (default): average of all reviewers' scores.
   * - combined: weighted blend of the self-score average and the reviewers' average
   *   (weight comes from cycle.selfWeight, a 0-100 percentage for the self portion).
   * - two_way: like managers_only, but upward reviewers (juniors appraising their boss)
   *   are included or excluded from the total based on cycle.upwardIncluded.
   * Reviewer averages prefer per-reviewer score rows (so every manager's scores count);
   * falls back to the shared managerScore column for legacy appraisals without them.
   */
  static async computeOverallScore(appraisalId: number, cycle: any | null): Promise<string | null> {
    const scoringMode = cycle?.scoringMode ?? "managers_only";
    const selfWeight = Math.min(100, Math.max(0, Number(cycle?.selfWeight ?? 30)));
    const upwardIncluded = cycle?.upwardIncluded ?? true;

    const allScores = await AppraisalScore.findAll({ where: { appraisalId } });
    const reviewerRows = await AppraisalReviewer.findAll({ where: { appraisalId } });
    const upwardReviewerIds = new Set(reviewerRows.filter((r: any) => r.isUpward).map((r: any) => r.reviewerId));
    const reviewerScoreRows = await AppraisalReviewerScore.findAll({ where: { appraisalId } });

    const countedReviewerScores = reviewerScoreRows.filter((r: any) => {
      if (r.score == null) return false;
      if (scoringMode === "two_way" && !upwardIncluded && upwardReviewerIds.has(r.reviewerId)) return false;
      return true;
    });

    let managerAvg: number | null = null;
    if (countedReviewerScores.length > 0) {
      const vals = countedReviewerScores.map((r: any) => Number(r.score));
      managerAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
    } else if (reviewerScoreRows.length === 0) {
      // Legacy fallback only: the shared managerScore column can contain scores
      // written by upward reviewers, so never fall back to it when per-reviewer
      // rows exist but were all excluded (e.g. upward-separate mode).
      const mgScores = allScores.filter((s: any) => s.managerScore != null).map((s: any) => Number(s.managerScore));
      if (mgScores.length > 0) managerAvg = mgScores.reduce((a, b) => a + b, 0) / mgScores.length;
    }

    if (scoringMode === "combined") {
      const selfScores = allScores.filter((s: any) => s.selfScore != null).map((s: any) => Number(s.selfScore));
      const selfAvg = selfScores.length > 0 ? selfScores.reduce((a, b) => a + b, 0) / selfScores.length : null;
      if (selfAvg != null && managerAvg != null) {
        const w = selfWeight / 100;
        return String(selfAvg * w + managerAvg * (1 - w));
      }
      if (selfAvg != null && managerAvg == null) return String(selfAvg);
    }

    return managerAvg != null ? String(managerAvg) : null;
  }

  /** Average of the upward (junior -> boss) reviewers' scores, or null when none exist. */
  static async computeUpwardScore(appraisalId: number): Promise<number | null> {
    const upwardRows = await AppraisalReviewer.findAll({ where: { appraisalId, isUpward: true } });
    if (upwardRows.length === 0) return null;
    const upwardIds = upwardRows.map((r: any) => r.reviewerId);
    const scoreRows = await AppraisalReviewerScore.findAll({ where: { appraisalId, reviewerId: { [Op.in]: upwardIds } } });
    const vals = scoreRows.filter((r: any) => r.score != null).map((r: any) => Number(r.score));
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  /**
   * In a two_way cycle, every reviewer (boss) also gets appraised by the employee.
   * Finds or creates the reviewer's own appraisal in the same cycle and adds the
   * employee as an upward reviewer on it.
   */
  static async ensureUpwardAppraisals(params: {
    cycleId: number; employeeId: number; reviewerIds: number[];
    workflowType: string; criteriaGroupId?: number | null;
  }) {
    const { cycleId, employeeId, workflowType, criteriaGroupId } = params;
    for (const reviewerId of params.reviewerIds) {
      if (!reviewerId || reviewerId === employeeId) continue;

      // Each reciprocal creation runs in its own transaction guarded by an
      // advisory lock on (cycleId, reviewerId) so concurrent creates cannot
      // produce duplicate boss appraisals or reviewer rows.
      await sequelize.transaction(async (t) => {
        await sequelize.query("SELECT pg_advisory_xact_lock(:k1, :k2)", {
          replacements: { k1: cycleId, k2: reviewerId },
          transaction: t,
        });

        let bossAppraisal: any = await Appraisal.findOne({ where: { cycleId, employeeId: reviewerId }, transaction: t });
        if (!bossAppraisal) {
          bossAppraisal = await Appraisal.create({
            cycleId,
            employeeId: reviewerId,
            reviewerId: employeeId,
            workflowType: workflowType ?? "admin_approval",
            status: "self_review",
            criteriaGroupId: criteriaGroupId ? Number(criteriaGroupId) : null,
          }, { transaction: t });

          let criteriaToScore = await Criterion.findAll({ transaction: t });
          if (criteriaGroupId) {
            const groupItems = await CriteriaGroupItem.findAll({ where: { groupId: Number(criteriaGroupId) }, transaction: t });
            const groupCriterionIds = new Set(groupItems.map((i: any) => i.criterionId));
            criteriaToScore = criteriaToScore.filter((c: any) => groupCriterionIds.has(c.id));
          }
          if (criteriaToScore.length > 0) {
            await AppraisalScore.bulkCreate(
              criteriaToScore.map((c: any) => ({ appraisalId: (bossAppraisal as any).id, criterionId: c.id })),
              { transaction: t }
            );
          }
        }

        const bossPlain = bossAppraisal.get ? bossAppraisal.get({ plain: true }) : bossAppraisal;
        // Don't append upward reviewers to appraisals that already moved past
        // manager review — the feedback could never be submitted.
        if (["completed", "pending_approval"].includes(bossPlain.status)) return;

        const bossAppraisalId = (bossAppraisal as any).id;
        const existingRow = await AppraisalReviewer.findOne({
          where: { appraisalId: bossAppraisalId, reviewerId: employeeId },
          transaction: t,
        });
        if (!existingRow) {
          const maxOrderRow: any = await AppraisalReviewer.findOne({
            where: { appraisalId: bossAppraisalId },
            order: [["orderIndex", "DESC"]],
            transaction: t,
          });
          const nextOrder = maxOrderRow ? Number(maxOrderRow.orderIndex) + 1 : 0;
          await AppraisalReviewer.create({
            appraisalId: bossAppraisalId,
            reviewerId: employeeId,
            orderIndex: nextOrder,
            status: "pending",
            isUpward: true,
          }, { transaction: t });
          // If the boss's appraisal is already in manager review with no active
          // reviewer, activate the newly added upward reviewer.
          if (bossPlain.status === "manager_review") {
            const active = await AppraisalReviewer.findOne({
              where: { appraisalId: bossAppraisalId, status: "in_progress" },
              transaction: t,
            });
            if (!active) {
              await AppraisalReviewer.update(
                { status: "in_progress" },
                { where: { appraisalId: bossAppraisalId, reviewerId: employeeId }, transaction: t }
              );
            }
          }
        }
      });
    }
  }

  static async getReviewersForAppraisal(appraisalId: number) {
    const rows = await AppraisalReviewer.findAll({
      where: { appraisalId },
      order: [["orderIndex", "ASC"]],
    });
    if (rows.length === 0) return [];
    const reviewerIds = rows.map((r: any) => r.reviewerId);
    const reviewerUsers = await User.findAll({ where: { id: { [Op.in]: reviewerIds } } });
    const userMap = Object.fromEntries(reviewerUsers.map((u: any) => [u.id, u]));
    return rows.map((row: any) => ({
      ...(formatUser(userMap[row.reviewerId]) ?? { id: row.reviewerId, name: 'Unknown', email: '', role: 'employee', managerId: null, department: null, jobTitle: null, createdAt: null }),
      stepStatus: row.status,
      orderIndex: row.orderIndex,
      isUpward: !!row.isUpward,
      managerComment: row.managerComment,
      reviewedAt: row.reviewedAt,
    }));
  }

  static async getReviewerScoresForAppraisal(appraisalId: number) {
    const reviewerScoreRows = await AppraisalReviewerScore.findAll({ where: { appraisalId } });
    const reviewerIds = [...new Set(reviewerScoreRows.map((r: any) => r.reviewerId))];
    const reviewerUsers = reviewerIds.length > 0
      ? await User.findAll({ where: { id: { [Op.in]: reviewerIds } } })
      : [];
    const reviewerUserMap = Object.fromEntries(reviewerUsers.map((u: any) => [u.id, u]));

    const junctionRows = await AppraisalReviewer.findAll({
      where: { appraisalId },
      order: [["orderIndex", "ASC"]],
    });

    return reviewerIds.map((rid: any) => {
      const user = reviewerUserMap[rid];
      const junction = junctionRows.find((r: any) => r.reviewerId === rid);
      return {
        reviewerId: rid,
        reviewerName: user?.name ?? `Reviewer ${rid}`,
        reviewerRole: user?.role,
        comment: junction?.managerComment ?? null,
        reviewedAt: junction?.reviewedAt ?? null,
        stepStatus: junction?.status ?? null,
        orderIndex: junction?.orderIndex ?? 0,
        scores: reviewerScoreRows
          .filter((r: any) => r.reviewerId === rid)
          .map((r: any) => ({ criterionId: r.criterionId, score: r.score, note: r.note, actualValue: r.actualValue })),
      };
    }).sort((a: any, b: any) => a.orderIndex - b.orderIndex);
  }

  static async enrichAppraisal(appraisal: any) {
    const plain = appraisal.get ? appraisal.get({ plain: true }) : appraisal;
    const employee = await User.findByPk(plain.employeeId);
    const cycle = await Cycle.findByPk(plain.cycleId);
    const reviewers = await AppraisalController.getReviewersForAppraisal(plain.id);
    const currentReviewer = reviewers.find((r: any) => r.stepStatus === 'in_progress') ?? reviewers.find((r: any) => r.stepStatus === 'pending') ?? null;
    const reviewer = currentReviewer ?? (reviewers.length > 0 ? reviewers[0] : null);

    const hasUpward = reviewers.some((r: any) => r.isUpward);
    const upwardScore = hasUpward ? await AppraisalController.computeUpwardScore(plain.id) : null;

    return {
      ...plain,
      employee: formatUser(employee),
      reviewer,
      reviewers,
      upwardScore,
      cycle: cycle ? cycle.get({ plain: true }) : null,
    };
  }

  static async activateNextReviewer(appraisalId: number): Promise<boolean> {
    const row = await AppraisalReviewer.findOne({
      where: { appraisalId, status: 'pending' },
      order: [["orderIndex", "ASC"]],
    });
    if (!row) return false;
    await AppraisalReviewer.update({ status: 'in_progress' }, { where: { id: (row as any).id } });
    return true;
  }

  static async getAll(filters: { cycleId?: number; employeeId?: number; userRole: string; userId: number }) {
    const where: any = {};
    if (filters.cycleId) where.cycleId = filters.cycleId;
    if (filters.employeeId) where.employeeId = filters.employeeId;

    if (filters.userRole === "employee") {
      // Employees see their own appraisals plus any appraisal they are assigned
      // to review (e.g. upward reviews of their manager in two-way cycles).
      const reviewerRows = await AppraisalReviewer.findAll({
        where: { reviewerId: filters.userId },
        attributes: ["appraisalId"],
      });
      const reviewerAppraisalIds = reviewerRows.map((r: any) => r.appraisalId);
      if (reviewerAppraisalIds.length > 0) {
        where[Op.or as any] = [
          { employeeId: filters.userId },
          { id: { [Op.in]: reviewerAppraisalIds } },
        ];
      } else {
        where.employeeId = filters.userId;
      }
    } else if (filters.userRole === "manager") {
      const teamMembers = await User.findAll({ where: { managerId: filters.userId }, attributes: ["id"] });
      const memberIds = teamMembers.map((m: any) => m.id);
      const reviewerRows = await AppraisalReviewer.findAll({
        where: { reviewerId: filters.userId },
        attributes: ["appraisalId"],
      });
      const reviewerAppraisalIds = reviewerRows.map((r: any) => r.appraisalId);
      const orConditions: any[] = [
        // Managers always see their own appraisals (e.g. when another manager reviews them)
        { employeeId: filters.userId },
      ];
      if (memberIds.length > 0) orConditions.push({ employeeId: { [Op.in]: memberIds } });
      if (reviewerAppraisalIds.length > 0) orConditions.push({ id: { [Op.in]: reviewerAppraisalIds } });
      where[Op.or as any] = orConditions;
    }

    const appraisals = await Appraisal.findAll({ where, order: [["createdAt", "ASC"]] });
    return Promise.all(appraisals.map((a: any) => AppraisalController.enrichAppraisal(a)));
  }

  static async create(data: {
    cycleId: number; employeeId: number; reviewerIds: number[];
    workflowType: string; criteriaGroupId?: number | null;
    budgetValues?: Record<number, number>;
    scheduledStartAt?: Date | string | null;
  }) {
    const orderedIds = data.reviewerIds;
    const scheduledAt = parseScheduledStart(data.scheduledStartAt);
    const isScheduled = !!(scheduledAt && scheduledAt.getTime() > Date.now());

    const appraisal = await Appraisal.create({
      cycleId: data.cycleId,
      employeeId: data.employeeId,
      reviewerId: orderedIds[0] ?? null,
      workflowType: data.workflowType ?? "admin_approval",
      status: isScheduled ? "scheduled" : "self_review",
      criteriaGroupId: data.criteriaGroupId ? Number(data.criteriaGroupId) : null,
      scheduledStartAt: isScheduled ? scheduledAt : null,
    });

    const appraisalId = (appraisal as any).id;

    if (orderedIds.length > 0) {
      await AppraisalReviewer.bulkCreate(
        orderedIds.map((rid: number, idx: number) => ({
          appraisalId,
          reviewerId: rid,
          orderIndex: idx,
          status: 'pending',
        })),
        { ignoreDuplicates: true }
      );
    }

    let criteriaToScore = await Criterion.findAll();
    if (data.criteriaGroupId) {
      const groupItems = await CriteriaGroupItem.findAll({ where: { groupId: Number(data.criteriaGroupId) } });
      const groupCriterionIds = new Set(groupItems.map((i: any) => i.criterionId));
      criteriaToScore = criteriaToScore.filter((c: any) => groupCriterionIds.has(c.id));
    }

    const budgetMap: Record<number, number> = data.budgetValues ?? {};

    if (criteriaToScore.length > 0) {
      await AppraisalScore.bulkCreate(
        criteriaToScore.map((c: any) => ({
          appraisalId,
          criterionId: c.id,
          budgetValue: budgetMap[c.id] != null ? String(budgetMap[c.id]) : null,
        }))
      );
    }

    const cycleRow: any = await Cycle.findByPk(Number(data.cycleId));
    if (cycleRow && cycleRow.scoringMode === "two_way") {
      await AppraisalController.ensureUpwardAppraisals({
        cycleId: Number(data.cycleId),
        employeeId: data.employeeId,
        reviewerIds: orderedIds,
        workflowType: data.workflowType ?? "admin_approval",
        criteriaGroupId: data.criteriaGroupId,
      });
    }

    return AppraisalController.enrichAppraisal(appraisal);
  }

  static async bulkCreate(data: {
    cycleId: number; employeeIds: number[]; reviewerIds: number[];
    workflowType: string; criteriaGroupId?: number | null;
    budgetsByCategory?: Record<string, Record<number, number>>;
    currentUser: { id: number; role: string };
    scheduledStartAt?: Date | string | null;
  }) {
    const scheduledAt = parseScheduledStart(data.scheduledStartAt);
    const isScheduled = !!(scheduledAt && scheduledAt.getTime() > Date.now());
    const uniqueEmpIds = [...new Set(data.employeeIds.map(Number).filter(n => !isNaN(n) && n > 0))];
    if (uniqueEmpIds.length === 0) throw new Error("No valid employee IDs provided");

    const employees = await User.findAll({ where: { id: { [Op.in]: uniqueEmpIds } } });
    const empMap = Object.fromEntries(employees.map((e: any) => [e.id, e]));

    if (data.currentUser.role === "manager") {
      const teamMembers = await User.findAll({ where: { managerId: data.currentUser.id }, attributes: ["id"] });
      const teamIds = new Set(teamMembers.map((m: any) => m.id));
      const unauthorized = uniqueEmpIds.filter(id => !teamIds.has(id));
      if (unauthorized.length > 0) throw new Error("FORBIDDEN:You can only create appraisals for your team members");
    }

    const orderedReviewerIds = data.reviewerIds;

    let criteriaToScore = await Criterion.findAll();
    if (data.criteriaGroupId) {
      const groupItems = await CriteriaGroupItem.findAll({ where: { groupId: Number(data.criteriaGroupId) } });
      const groupCriterionIds = new Set(groupItems.map((i: any) => i.criterionId));
      criteriaToScore = criteriaToScore.filter((c: any) => groupCriterionIds.has(c.id));
    }

    const categoryBudgets: Record<string, Record<number, number>> = data.budgetsByCategory ?? {};

    const results = await sequelize.transaction(async (t) => {
      const created = [];
      for (const empId of uniqueEmpIds) {
        const emp = empMap[empId];
        if (!emp) continue;

        const appraisal = await Appraisal.create({
          cycleId: Number(data.cycleId),
          employeeId: empId,
          reviewerId: orderedReviewerIds[0] ?? null,
          workflowType: data.workflowType ?? "admin_approval",
          status: isScheduled ? "scheduled" : "self_review",
          criteriaGroupId: data.criteriaGroupId ? Number(data.criteriaGroupId) : null,
          scheduledStartAt: isScheduled ? scheduledAt : null,
        }, { transaction: t });

        const appraisalId = (appraisal as any).id;

        if (orderedReviewerIds.length > 0) {
          await AppraisalReviewer.bulkCreate(
            orderedReviewerIds.map((rid: number, idx: number) => ({
              appraisalId,
              reviewerId: rid,
              orderIndex: idx,
              status: 'pending',
            })),
            { ignoreDuplicates: true, transaction: t }
          );
        }

        const category = ((emp as any).jobTitle || "Uncategorized").trim();
        const catBudget = categoryBudgets[category] || {};

        if (criteriaToScore.length > 0) {
          await AppraisalScore.bulkCreate(
            criteriaToScore.map((c: any) => ({
              appraisalId,
              criterionId: c.id,
              budgetValue: catBudget[c.id] != null ? String(catBudget[c.id]) : null,
            })),
            { transaction: t }
          );
        }

        created.push(appraisal);
      }
      return created;
    });

    const cycleRow: any = await Cycle.findByPk(Number(data.cycleId));
    if (cycleRow && cycleRow.scoringMode === "two_way") {
      for (const empId of uniqueEmpIds) {
        if (!empMap[empId]) continue;
        await AppraisalController.ensureUpwardAppraisals({
          cycleId: Number(data.cycleId),
          employeeId: empId,
          reviewerIds: orderedReviewerIds,
          workflowType: data.workflowType ?? "admin_approval",
          criteriaGroupId: data.criteriaGroupId,
        });
      }
    }

    return { created: results.length, appraisalIds: results.map((a: any) => a.id) };
  }

  static async getById(id: number) {
    const appraisal = await Appraisal.findByPk(id);
    if (!appraisal) return null;

    const scores = await AppraisalScore.findAll({ where: { appraisalId: id } });
    const enrichedScores = await Promise.all(scores.map(async (s: any) => {
      const criterion = await Criterion.findByPk(s.criterionId);
      return { ...s.get({ plain: true }), criterion: criterion ? criterion.get({ plain: true }) : null };
    }));

    const [enriched, reviewerScores] = await Promise.all([
      AppraisalController.enrichAppraisal(appraisal),
      AppraisalController.getReviewerScoresForAppraisal(id),
    ]);
    return { ...enriched, scores: enrichedScores, reviewerScores };
  }

  static async update(appraisalId: number, body: any, currentUser: { id: number; role: string }) {
    const { action, selfComment, managerComment, scores } = body;

    const current = await Appraisal.findByPk(appraisalId);
    if (!current) return { error: "Not found", status: 404 };

    const currentPlain = (current as any).get({ plain: true });

    if (action === "reschedule") {
      if (!["admin", "super_admin"].includes(currentUser.role)) {
        return { error: "Only admins can reschedule appraisals", status: 403 };
      }
      if (currentPlain.status !== "scheduled") {
        return { error: "Only scheduled appraisals can be rescheduled", status: 400 };
      }
      const newAt = parseScheduledStart(body.scheduledStartAt);
      if (!newAt || newAt.getTime() <= Date.now()) {
        return { error: "scheduledStartAt must be a future date", status: 400 };
      }
      await Appraisal.update({ scheduledStartAt: newAt }, { where: { id: appraisalId } });
      const enriched = await AppraisalController.enrichAppraisal(await Appraisal.findByPk(appraisalId));
      return { data: enriched };
    }

    if (action === "start_now" && currentPlain.status === "scheduled") {
      if (!["admin", "super_admin"].includes(currentUser.role)) {
        return { error: "Only admins can start scheduled appraisals early", status: 403 };
      }
      await Appraisal.update({ status: "self_review", scheduledStartAt: null }, { where: { id: appraisalId } });
      const enriched = await AppraisalController.enrichAppraisal(await Appraisal.findByPk(appraisalId));
      return { data: enriched };
    }

    if (currentPlain.status === "scheduled") {
      return { error: "This appraisal is scheduled and has not started yet.", status: 400 };
    }

    const updates: any = {};

    const preSubmitReviewerRow = currentPlain.status === "manager_review"
      ? await AppraisalReviewer.findOne({ where: { appraisalId, status: 'in_progress' } })
      : null;
    const submittingReviewerId = (preSubmitReviewerRow as any)?.reviewerId ?? currentUser.id;

    // During manager review, a caller who is an assigned reviewer may only
    // write review data / submit when it is their turn (their row is the
    // in-progress one). Admins are exempt; the appraisal subject and team
    // managers without a reviewer row keep their existing access.
    if (currentPlain.status === "manager_review" && !["admin", "super_admin"].includes(currentUser.role)) {
      const { action: bodyAction, scores: bodyScores, managerComment: bodyManagerComment } = body ?? {};
      const touchesReview = bodyAction === "submit"
        || bodyManagerComment !== undefined
        || (Array.isArray(bodyScores) && bodyScores.some((s: any) => s?.managerScore != null));
      if (touchesReview && currentPlain.employeeId !== currentUser.id) {
        const callerReviewerRow = await AppraisalReviewer.findOne({
          where: { appraisalId, reviewerId: currentUser.id },
        });
        if (callerReviewerRow && (preSubmitReviewerRow as any)?.reviewerId !== currentUser.id) {
          return { error: "It's not your turn to review this appraisal yet", status: 403 };
        }
      }
    }

    if (action === "resend_review") {
      const isEmployee = currentUser.id === currentPlain.employeeId;
      if (!isEmployee && !["admin", "super_admin", "manager"].includes(currentUser.role)) {
        return { error: "Only the employee, admins, or managers can resend for review", status: 403 };
      }
      if (currentUser.role === "manager" && !isEmployee) {
        const isReviewer = await AppraisalReviewer.findOne({ where: { appraisalId, reviewerId: currentUser.id } });
        const teamMembers = await User.findAll({ where: { managerId: currentUser.id }, attributes: ["id"] });
        const isManager = teamMembers.some((m: any) => m.id === currentPlain.employeeId);
        if (!isReviewer && !isManager) {
          return { error: "You can only resend appraisals for your team members or reviews assigned to you", status: 403 };
        }
      }
      await AppraisalReviewer.update(
        { status: 'pending', managerComment: null, reviewedAt: null },
        { where: { appraisalId } }
      );
      await AppraisalReviewerScore.destroy({ where: { appraisalId } });
      updates.status = "self_review";
      updates.overallScore = null;
      updates.managerComment = null;

      const { budgetValues: resendBudgets } = body;
      if (resendBudgets && typeof resendBudgets === 'object') {
        for (const [critIdStr, val] of Object.entries(resendBudgets)) {
          await AppraisalScore.update(
            { budgetValue: val != null ? String(val) : null, managerScore: null, managerNote: null },
            { where: { appraisalId, criterionId: Number(critIdStr) } }
          );
        }
      }
    }

    if (action === "update_budgets") {
      if (!["admin", "super_admin", "manager"].includes(currentUser.role)) {
        return { error: "Only admins/managers can update budget values", status: 403 };
      }
      if (currentUser.role === "manager") {
        const isReviewer = await AppraisalReviewer.findOne({ where: { appraisalId, reviewerId: currentUser.id } });
        const teamMembers = await User.findAll({ where: { managerId: currentUser.id }, attributes: ["id"] });
        const isManager = teamMembers.some((m: any) => m.id === currentPlain.employeeId);
        if (!isReviewer && !isManager) {
          return { error: "You can only update budgets for your team members or reviews assigned to you", status: 403 };
        }
      }
      const { budgetValues: budgetUpdates } = body;
      if (budgetUpdates && typeof budgetUpdates === 'object') {
        for (const [critIdStr, val] of Object.entries(budgetUpdates)) {
          await AppraisalScore.update(
            { budgetValue: val != null ? String(val) : null },
            { where: { appraisalId, criterionId: Number(critIdStr) } }
          );
        }
      }
    }

    if (action === "update_actuals") {
      if (!["admin", "super_admin", "manager"].includes(currentUser.role)) {
        return { error: "Only admins/managers can update actual values", status: 403 };
      }
      const { adminActualValues } = body;
      if (adminActualValues && typeof adminActualValues === 'object') {
        for (const [critIdStr, val] of Object.entries(adminActualValues)) {
          await AppraisalScore.update(
            { adminActualValue: val != null ? String(val) : null },
            { where: { appraisalId, criterionId: Number(critIdStr) } }
          );
        }
      }
      const allScores = await AppraisalScore.findAll({ where: { appraisalId } });
      const enrichedScores = await Promise.all(allScores.map(async (s: any) => {
        const criterion = await Criterion.findByPk(s.criterionId);
        return { ...s.get({ plain: true }), criterion: criterion ? criterion.get({ plain: true }) : null };
      }));
      const enriched = await AppraisalController.enrichAppraisal(current);
      return { data: { ...enriched, scores: enrichedScores } };
    }

    if (action === "accept_value") {
      if (!["admin", "super_admin", "manager"].includes(currentUser.role)) {
        return { error: "Only admins/managers can accept values", status: 403 };
      }
      const { criterionId, accepted } = body;
      if (criterionId && accepted) {
        await AppraisalScore.update(
          { acceptedValue: accepted },
          { where: { appraisalId, criterionId: Number(criterionId) } }
        );
      }
      const allScores = await AppraisalScore.findAll({ where: { appraisalId } });
      const enrichedScores = await Promise.all(allScores.map(async (s: any) => {
        const criterion = await Criterion.findByPk(s.criterionId);
        return { ...s.get({ plain: true }), criterion: criterion ? criterion.get({ plain: true }) : null };
      }));
      const enriched = await AppraisalController.enrichAppraisal(current);
      return { data: { ...enriched, scores: enrichedScores } };
    }

    if (action === "submit") {
      if (currentPlain.status === "self_review") {
        updates.status = "manager_review";
      } else if (currentPlain.status === "manager_review") {
        const inProgressRow = await AppraisalReviewer.findOne({
          where: { appraisalId, status: 'in_progress' },
        });

        if (inProgressRow) {
          await AppraisalReviewer.update(
            { status: 'completed', managerComment: managerComment || null, reviewedAt: new Date() },
            { where: { id: (inProgressRow as any).id } }
          );
        }

        const hasNext = await AppraisalController.activateNextReviewer(appraisalId);
        if (!hasNext) {
          const next = nextAppraisalStatus(currentPlain.status, currentPlain.workflowType, true);
          if (next) updates.status = next;
        }
      } else if (currentPlain.status === "pending_approval") {
        updates.status = "completed";
      }
    }

    if (selfComment !== undefined) updates.selfComment = selfComment;
    if (managerComment !== undefined && currentPlain.status === "manager_review") {
      updates.managerComment = managerComment;
    }

    const currentReviewerId = submittingReviewerId;

    if (scores && Array.isArray(scores)) {
      for (const score of scores) {
        const existing = await AppraisalScore.findOne({
          where: { appraisalId, criterionId: score.criterionId },
        });
        if (existing) {
          await AppraisalScore.update(
            {
              selfScore: score.selfScore,
              managerScore: score.managerScore,
              selfNote: score.selfNote,
              managerNote: score.managerNote,
              actualValue: score.actualValue ?? (existing as any).actualValue,
            },
            { where: { id: (existing as any).id } }
          );
        }

        if (currentPlain.status === "manager_review" && score.managerScore != null) {
          const existingRevScore = await AppraisalReviewerScore.findOne({
            where: { appraisalId, reviewerId: currentReviewerId, criterionId: score.criterionId },
          });
          if (existingRevScore) {
            await AppraisalReviewerScore.update(
              { score: score.managerScore, note: score.managerNote, actualValue: score.actualValue ?? null },
              { where: { id: (existingRevScore as any).id } }
            );
          } else {
            await AppraisalReviewerScore.create({
              appraisalId,
              reviewerId: currentReviewerId,
              criterionId: score.criterionId,
              score: score.managerScore,
              note: score.managerNote,
              actualValue: score.actualValue ?? null,
            });
          }
        }
      }
      const targetStatus = updates.status ?? currentPlain.status;
      if (targetStatus === "pending_approval" || targetStatus === "completed") {
        const cycleForScore = await Cycle.findByPk(currentPlain.cycleId);
        const overall = await AppraisalController.computeOverallScore(
          appraisalId, cycleForScore ? cycleForScore.get({ plain: true }) : null
        );
        if (overall != null) updates.overallScore = overall;
      }
    }

    if (action === "submit" && currentPlain.status === "pending_approval" && !scores) {
      if (!currentPlain.overallScore) {
        const cycleForScore = await Cycle.findByPk(currentPlain.cycleId);
        const overall = await AppraisalController.computeOverallScore(
          appraisalId, cycleForScore ? cycleForScore.get({ plain: true }) : null
        );
        if (overall != null) updates.overallScore = overall;
      }
    }

    if (updates.status === "manager_review") {
      await AppraisalController.activateNextReviewer(appraisalId);
    }

    const [updateCount, updatedRows] = await Appraisal.update(updates, { where: { id: appraisalId }, returning: true });
    if (!updatedRows[0]) return { error: "Not found", status: 404 };

    const allScores = await AppraisalScore.findAll({ where: { appraisalId } });
    const enrichedScores = await Promise.all(allScores.map(async (s: any) => {
      const criterion = await Criterion.findByPk(s.criterionId);
      return { ...s.get({ plain: true }), criterion: criterion ? criterion.get({ plain: true }) : null };
    }));

    const [enriched, reviewerScores] = await Promise.all([
      AppraisalController.enrichAppraisal(updatedRows[0]),
      AppraisalController.getReviewerScoresForAppraisal(appraisalId),
    ]);
    return { data: { ...enriched, scores: enrichedScores, reviewerScores } };
  }

  static async addReviewer(appraisalId: number, reviewerId: number) {
    const appraisal = await Appraisal.findByPk(appraisalId);
    if (!appraisal) return { error: "Not found", status: 404 };

    const existing = await AppraisalController.getReviewersForAppraisal(appraisalId);
    const nextOrder = existing.length;

    await AppraisalReviewer.bulkCreate(
      [{ appraisalId, reviewerId: Number(reviewerId), orderIndex: nextOrder, status: 'pending' }],
      { ignoreDuplicates: true }
    );

    if (!(appraisal as any).reviewerId) {
      await Appraisal.update({ reviewerId: Number(reviewerId) }, { where: { id: appraisalId } });
    }

    const reviewers = await AppraisalController.getReviewersForAppraisal(appraisalId);
    return { data: { reviewers } };
  }

  static async activateDueScheduled(): Promise<number> {
    const result = await Appraisal.update(
      { status: "self_review", scheduledStartAt: null },
      {
        where: {
          status: "scheduled",
          scheduledStartAt: { [Op.lte]: new Date() },
        },
      }
    );
    return Array.isArray(result) ? Number(result[0]) || 0 : 0;
  }

  static async delete(id: number) {
    await AppraisalReviewer.destroy({ where: { appraisalId: id } });
    await AppraisalReviewerScore.destroy({ where: { appraisalId: id } });
    await AppraisalScore.destroy({ where: { appraisalId: id } });
    await Appraisal.destroy({ where: { id } });
  }

  static async removeReviewer(appraisalId: number, reviewerId: number) {
    await AppraisalReviewer.destroy({
      where: { appraisalId, reviewerId },
    });
    const remaining = await AppraisalController.getReviewersForAppraisal(appraisalId);
    for (let i = 0; i < remaining.length; i++) {
      await AppraisalReviewer.update(
        { orderIndex: i },
        { where: { appraisalId, reviewerId: remaining[i].id } }
      );
    }
    await Appraisal.update(
      { reviewerId: remaining.length > 0 ? remaining[0].id : null },
      { where: { id: appraisalId } }
    );
    return await AppraisalController.getReviewersForAppraisal(appraisalId);
  }
}
