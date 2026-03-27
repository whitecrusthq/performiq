import { Router } from "express";
import { db, usersTable, cyclesTable, appraisalsTable, goalsTable } from "@workspace/db";
import { eq, and, count, inArray } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/dashboard", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: userId, role } = req.user!;

    if (role === "admin" || role === "super_admin") {
      const [empCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "employee"));
      const [mgrCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "manager"));
      const [activeCount] = await db.select({ count: count() }).from(cyclesTable).where(eq(cyclesTable.status, "active"));
      const [pendingCount] = await db.select({ count: count() }).from(appraisalsTable).where(eq(appraisalsTable.status, "pending"));
      const [awaitingApprovalCount] = await db.select({ count: count() }).from(appraisalsTable).where(eq(appraisalsTable.status, "pending_approval"));
      const [completedCount] = await db.select({ count: count() }).from(appraisalsTable).where(eq(appraisalsTable.status, "completed"));
      const [myGoals] = await db.select({ count: count() }).from(goalsTable);
      const [activeGoals] = await db.select({ count: count() }).from(goalsTable).where(eq(goalsTable.status, "in_progress"));

      const recentAppraisals = await db.select().from(appraisalsTable).orderBy(appraisalsTable.createdAt).limit(5);
      const enrichedAppraisals = await Promise.all(recentAppraisals.map(async (a) => {
        const [emp] = await db.select().from(usersTable).where(eq(usersTable.id, a.employeeId)).limit(1);
        const [cyc] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, a.cycleId)).limit(1);
        return { ...a, employee: emp, cycle: cyc, reviewer: null };
      }));

      const recentGoals = await db.select().from(goalsTable).orderBy(goalsTable.createdAt).limit(5);
      const enrichedGoals = await Promise.all(recentGoals.map(async (g) => {
        const [u] = await db.select().from(usersTable).where(eq(usersTable.id, g.userId)).limit(1);
        return { ...g, user: u };
      }));

      res.json({
        role,
        totalEmployees: Number(empCount.count),
        totalManagers: Number(mgrCount.count),
        activeCycles: Number(activeCount.count),
        pendingAppraisals: Number(pendingCount.count),
        awaitingApproval: Number(awaitingApprovalCount.count),
        completedAppraisals: Number(completedCount.count),
        myGoals: Number(myGoals.count),
        activeGoals: Number(activeGoals.count),
        recentAppraisals: enrichedAppraisals,
        recentGoals: enrichedGoals,
      });
    } else if (role === "manager") {
      const team = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, userId));
      const teamIds = team.map(m => m.id);
      const [pendingCount] = teamIds.length > 0
        ? await db.select({ count: count() }).from(appraisalsTable).where(and(inArray(appraisalsTable.employeeId, teamIds), eq(appraisalsTable.status, "pending")))
        : [{ count: 0 }];
      const [completedCount] = teamIds.length > 0
        ? await db.select({ count: count() }).from(appraisalsTable).where(and(inArray(appraisalsTable.employeeId, teamIds), eq(appraisalsTable.status, "completed")))
        : [{ count: 0 }];
      const [myGoals] = await db.select({ count: count() }).from(goalsTable).where(eq(goalsTable.userId, userId));
      const [activeGoals] = await db.select({ count: count() }).from(goalsTable).where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "in_progress")));

      const recentAppraisals = teamIds.length > 0
        ? await db.select().from(appraisalsTable).where(inArray(appraisalsTable.employeeId, teamIds)).orderBy(appraisalsTable.createdAt).limit(5)
        : [];
      const enrichedAppraisals = await Promise.all(recentAppraisals.map(async (a) => {
        const [emp] = await db.select().from(usersTable).where(eq(usersTable.id, a.employeeId)).limit(1);
        const [cyc] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, a.cycleId)).limit(1);
        return { ...a, employee: emp, cycle: cyc, reviewer: null };
      }));

      const recentGoals = await db.select().from(goalsTable).where(eq(goalsTable.userId, userId)).orderBy(goalsTable.createdAt).limit(5);
      const enrichedGoals = await Promise.all(recentGoals.map(async (g) => {
        const [u] = await db.select().from(usersTable).where(eq(usersTable.id, g.userId)).limit(1);
        return { ...g, user: u };
      }));

      res.json({
        role,
        teamSize: teamIds.length,
        pendingAppraisals: Number(pendingCount.count),
        completedAppraisals: Number(completedCount.count),
        myGoals: Number(myGoals.count),
        activeGoals: Number(activeGoals.count),
        recentAppraisals: enrichedAppraisals,
        recentGoals: enrichedGoals,
      });
    } else {
      const [myAppraisals] = await db.select({ count: count() }).from(appraisalsTable).where(eq(appraisalsTable.employeeId, userId));
      const [pendingCount] = await db.select({ count: count() }).from(appraisalsTable).where(and(eq(appraisalsTable.employeeId, userId), eq(appraisalsTable.status, "self_review")));
      const [completedCount] = await db.select({ count: count() }).from(appraisalsTable).where(and(eq(appraisalsTable.employeeId, userId), eq(appraisalsTable.status, "completed")));
      const [myGoals] = await db.select({ count: count() }).from(goalsTable).where(eq(goalsTable.userId, userId));
      const [activeGoals] = await db.select({ count: count() }).from(goalsTable).where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "in_progress")));

      const recentAppraisals = await db.select().from(appraisalsTable).where(eq(appraisalsTable.employeeId, userId)).orderBy(appraisalsTable.createdAt).limit(5);
      const enrichedAppraisals = await Promise.all(recentAppraisals.map(async (a) => {
        const [emp] = await db.select().from(usersTable).where(eq(usersTable.id, a.employeeId)).limit(1);
        const [cyc] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, a.cycleId)).limit(1);
        return { ...a, employee: emp, cycle: cyc, reviewer: null };
      }));

      const recentGoals = await db.select().from(goalsTable).where(eq(goalsTable.userId, userId)).orderBy(goalsTable.createdAt).limit(5);
      const enrichedGoals = await Promise.all(recentGoals.map(async (g) => {
        const [u] = await db.select().from(usersTable).where(eq(usersTable.id, g.userId)).limit(1);
        return { ...g, user: u };
      }));

      res.json({
        role,
        pendingAppraisals: Number(pendingCount.count),
        completedAppraisals: Number(completedCount.count),
        myGoals: Number(myGoals.count),
        activeGoals: Number(activeGoals.count),
        totalAppraisals: Number(myAppraisals.count),
        recentAppraisals: enrichedAppraisals,
        recentGoals: enrichedGoals,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
