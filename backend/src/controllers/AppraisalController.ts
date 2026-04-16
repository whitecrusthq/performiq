import { Op } from "sequelize";
import { Appraisal, AppraisalScore, AppraisalReviewer, AppraisalReviewerScore, User, Cycle, Criterion, CriteriaGroupItem } from "../models/index.js";
import sequelize from "../db/sequelize.js";

const formatUser = (u: any) => u ? ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  managerId: u.managerId, department: u.department, jobTitle: u.jobTitle, createdAt: u.createdAt,
}) : null;

type AppraisalStatusValue = "pending" | "self_review" | "manager_review" | "pending_approval" | "completed";

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

    return {
      ...plain,
      employee: formatUser(employee),
      reviewer,
      reviewers,
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
      where.employeeId = filters.userId;
    } else if (filters.userRole === "manager") {
      const teamMembers = await User.findAll({ where: { managerId: filters.userId }, attributes: ["id"] });
      const memberIds = teamMembers.map((m: any) => m.id);
      const reviewerRows = await AppraisalReviewer.findAll({
        where: { reviewerId: filters.userId },
        attributes: ["appraisalId"],
      });
      const reviewerAppraisalIds = reviewerRows.map((r: any) => r.appraisalId);
      const orConditions: any[] = [];
      if (memberIds.length > 0) orConditions.push({ employeeId: { [Op.in]: memberIds } });
      if (reviewerAppraisalIds.length > 0) orConditions.push({ id: { [Op.in]: reviewerAppraisalIds } });
      if (orConditions.length > 0) {
        where[Op.or as any] = orConditions;
      } else {
        where.employeeId = -1;
      }
    }

    const appraisals = await Appraisal.findAll({ where, order: [["createdAt", "ASC"]] });
    return Promise.all(appraisals.map((a: any) => AppraisalController.enrichAppraisal(a)));
  }

  static async create(data: {
    cycleId: number; employeeId: number; reviewerIds: number[];
    workflowType: string; criteriaGroupId?: number | null;
    budgetValues?: Record<number, number>;
  }) {
    const orderedIds = data.reviewerIds;

    const appraisal = await Appraisal.create({
      cycleId: data.cycleId,
      employeeId: data.employeeId,
      reviewerId: orderedIds[0] ?? null,
      workflowType: data.workflowType ?? "admin_approval",
      status: "self_review",
      criteriaGroupId: data.criteriaGroupId ? Number(data.criteriaGroupId) : null,
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

    return AppraisalController.enrichAppraisal(appraisal);
  }

  static async bulkCreate(data: {
    cycleId: number; employeeIds: number[]; reviewerIds: number[];
    workflowType: string; criteriaGroupId?: number | null;
    budgetsByCategory?: Record<string, Record<number, number>>;
    currentUser: { id: number; role: string };
  }) {
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
          status: "self_review",
          criteriaGroupId: data.criteriaGroupId ? Number(data.criteriaGroupId) : null,
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

    const updates: any = {};

    const preSubmitReviewerRow = currentPlain.status === "manager_review"
      ? await AppraisalReviewer.findOne({ where: { appraisalId, status: 'in_progress' } })
      : null;
    const submittingReviewerId = (preSubmitReviewerRow as any)?.reviewerId ?? currentUser.id;

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
        const allScores = await AppraisalScore.findAll({ where: { appraisalId } });
        const mgScores = allScores.filter((s: any) => s.managerScore != null).map((s: any) => Number(s.managerScore));
        if (mgScores.length > 0) {
          updates.overallScore = String(mgScores.reduce((a: number, b: number) => a + b, 0) / mgScores.length);
        }
      }
    }

    if (action === "submit" && currentPlain.status === "pending_approval" && !scores) {
      const allScores = await AppraisalScore.findAll({ where: { appraisalId } });
      const mgScores = allScores.filter((s: any) => s.managerScore != null).map((s: any) => Number(s.managerScore));
      if (mgScores.length > 0 && !currentPlain.overallScore) {
        updates.overallScore = String(mgScores.reduce((a: number, b: number) => a + b, 0) / mgScores.length);
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
