import { Router } from "express";
import { db, usersTable, appraisalsTable, cyclesTable, criteriaTable, appraisalScoresTable } from "@workspace/db";
import { eq, sql, count, avg } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/reports", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    // --- Workforce overview ---
    const users = await db.select().from(usersTable);
    const roleBreakdown = users.reduce<Record<string, number>>((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});
    const deptBreakdown = users.reduce<Record<string, number>>((acc, u) => {
      const dept = u.department || "Unassigned";
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    // --- Appraisal overview ---
    const appraisals = await db
      .select({
        id: appraisalsTable.id,
        status: appraisalsTable.status,
        cycleId: appraisalsTable.cycleId,
        employeeId: appraisalsTable.employeeId,
        overallScore: appraisalsTable.overallScore,
      })
      .from(appraisalsTable);

    const statusBreakdown = appraisals.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});

    const total = appraisals.length;
    const completed = appraisals.filter(a => a.status === "completed").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const scored = appraisals.filter(a => a.overallScore !== null && a.overallScore !== undefined);
    const avgOverallScore = scored.length > 0
      ? Number((scored.reduce((s, a) => s + Number(a.overallScore), 0) / scored.length).toFixed(2))
      : null;

    // --- Score by department ---
    const empMap = new Map(users.map(u => [u.id, u]));
    const deptScores: Record<string, number[]> = {};
    for (const a of scored) {
      const dept = empMap.get(a.employeeId)?.department || "Unassigned";
      if (!deptScores[dept]) deptScores[dept] = [];
      deptScores[dept].push(Number(a.overallScore));
    }
    const avgScoreByDept = Object.entries(deptScores).map(([dept, scores]) => ({
      department: dept,
      avgScore: Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2)),
      count: scores.length,
    })).sort((a, b) => b.avgScore - a.avgScore);

    // --- Per-cycle stats ---
    const cycles = await db.select().from(cyclesTable);
    const cycleStats = cycles.map(c => {
      const cycleAppraisals = appraisals.filter(a => a.cycleId === c.id);
      const cycleCompleted = cycleAppraisals.filter(a => a.status === "completed").length;
      const cycleScored = cycleAppraisals.filter(a => a.overallScore !== null);
      const cycleAvg = cycleScored.length > 0
        ? Number((cycleScored.reduce((s, a) => s + Number(a.overallScore), 0) / cycleScored.length).toFixed(2))
        : null;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        total: cycleAppraisals.length,
        completed: cycleCompleted,
        completionRate: cycleAppraisals.length > 0 ? Math.round((cycleCompleted / cycleAppraisals.length) * 100) : 0,
        avgScore: cycleAvg,
      };
    });

    // --- Criteria scores ---
    const criteria = await db.select().from(criteriaTable);
    const allScores = await db.select().from(appraisalScoresTable);
    const criteriaStats = criteria.map(c => {
      const cScores = allScores.filter(s => s.criterionId === c.id);
      const selfScores = cScores.filter(s => s.selfScore !== null).map(s => Number(s.selfScore));
      const managerScores = cScores.filter(s => s.managerScore !== null).map(s => Number(s.managerScore));
      return {
        id: c.id,
        name: c.name,
        category: c.category,
        avgSelfScore: selfScores.length > 0 ? Number((selfScores.reduce((a, b) => a + b, 0) / selfScores.length).toFixed(2)) : null,
        avgManagerScore: managerScores.length > 0 ? Number((managerScores.reduce((a, b) => a + b, 0) / managerScores.length).toFixed(2)) : null,
        responseCount: cScores.length,
      };
    });

    // --- Rating distribution ---
    const ratingBands = [
      { label: "Outstanding (≥4.5)", min: 4.5, max: 99 },
      { label: "Exceeds Expectations (3.5–4.4)", min: 3.5, max: 4.49 },
      { label: "Meets Expectations (2.5–3.4)", min: 2.5, max: 3.49 },
      { label: "Needs Improvement (1.5–2.4)", min: 1.5, max: 2.49 },
      { label: "Unsatisfactory (<1.5)", min: 0, max: 1.49 },
    ];
    const ratingDistribution = ratingBands.map(band => ({
      label: band.label,
      count: scored.filter(a => {
        const v = Number(a.overallScore);
        return v >= band.min && v <= band.max;
      }).length,
    }));

    res.json({
      workforce: { total: users.length, roleBreakdown, deptBreakdown },
      appraisals: { total, completed, completionRate, avgOverallScore, statusBreakdown },
      avgScoreByDept,
      cycleStats,
      criteriaStats,
      ratingDistribution,
    });
  } catch (err) {
    console.error("GET /reports error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
