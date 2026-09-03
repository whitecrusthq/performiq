/**
 * Role-matrix tests: protected accounts (users.is_protected) must be hidden
 * from reports, dashboards, celebration lists, and enriched goal/appraisal/
 * leave records for everyone below super admin, while super admins see all.
 *
 * These tests run against the development database (DATABASE_URL) and clean
 * up every row they create.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  User, Goal, LeaveRequest, LeaveAllocation, Appraisal, Cycle,
} from "../models/index.js";
import ReportController from "./ReportController.js";
import DashboardController from "./DashboardController.js";
import AnniversaryController from "./AnniversaryController.js";
import GoalController from "./GoalController.js";
import AppraisalController from "./AppraisalController.js";
import LeaveController from "./LeaveController.js";
import { getProtectedUserIds } from "../utils/protectedUsers.js";

const EMAIL = "protected-test-user@example.test";
let prot: any; // the protected test user
let admin: any; // a non-super-admin viewer
let superAdmin: any;
let cycle: any;
let goal: any;
let appraisal: any;
let leaveReq: any;

before(async () => {
  await User.destroy({ where: { email: EMAIL } });
  prot = await User.create({
    name: "Protected Test User", email: EMAIL, passwordHash: "x",
    role: "employee", isProtected: true,
    dateOfBirth: "1990-06-15", startDate: "2020-01-02", weddingDate: "2015-03-03",
  } as any);
  admin = await User.findOne({ where: { role: "admin", isProtected: false } });
  superAdmin = await User.findOne({ where: { role: "super_admin" } });
  assert.ok(admin && superAdmin, "seed admin/super_admin users must exist");
  cycle = await Cycle.findOne();
  goal = await Goal.create({ title: "protected goal", status: "not_started", progress: 0, userId: prot.id, cycleId: cycle?.id } as any);
  appraisal = await Appraisal.create({ cycleId: cycle?.id ?? 1, employeeId: prot.id, status: "pending", workflowType: "admin_approval" } as any);
  leaveReq = await LeaveRequest.create({
    employeeId: prot.id, leaveType: "annual", startDate: "2026-08-17", endDate: "2026-08-18",
    days: 2, status: "pending",
  } as any);
});

after(async () => {
  await LeaveRequest.destroy({ where: { employeeId: prot.id } });
  await LeaveAllocation.destroy({ where: { employeeId: prot.id } });
  await Appraisal.destroy({ where: { employeeId: prot.id } });
  await Goal.destroy({ where: { userId: prot.id } });
  await User.destroy({ where: { id: prot.id } });
});

const contains = (data: any, needle: string) => JSON.stringify(data).includes(needle);

test("getProtectedUserIds includes the protected user and honors the exception", async () => {
  assert.ok((await getProtectedUserIds()).has(prot.id));
  assert.ok(!(await getProtectedUserIds(prot.id)).has(prot.id));
});

test("reports hide the protected user from admins but not super admins", async () => {
  const adminView = await DashboardController.getDashboard(admin.id, "admin");
  const superView = await DashboardController.getDashboard(superAdmin.id, "super_admin");
  assert.equal(superView.totalEmployees!, adminView.totalEmployees! + 1);
  assert.ok(superView.pendingAppraisals >= adminView.pendingAppraisals + 1);
  assert.ok(superView.myGoals >= adminView.myGoals + 1);
});

test("celebration lists hide protected accounts below super admin", async () => {
  for (const fn of ["listAnniversaries", "listBirthdays", "listWeddings"] as const) {
  const a = await LeaveController.listLeaveRequests(admin.id, "admin");
  assert.equal(a.some((r: any) => r.employeeId === prot.id), false);
  const s = await LeaveController.listLeaveRequests(superAdmin.id, "super_admin");
    if (fn === "getLeaveSummary") assert.equal(contains(s, prot.name), true, `${fn} hidden from super admin`);
  }
});

test("dashboard hides protected accounts from admin counts and recent lists", async () => {
  const adminView = await DashboardController.getDashboard(admin.id, "admin");
  assert.equal(contains(adminView, prot.name), false);
  const superView = await DashboardController.getDashboard(superAdmin.id, "super_admin");
  assert.equal(superView.totalEmployees!, adminView.totalEmployees! + 1);
  assert.ok(superView.pendingAppraisals >= adminView.pendingAppraisals + 1);
  assert.ok(superView.myGoals >= adminView.myGoals + 1);
});

test("celebration lists hide protected accounts below super admin", async () => {
  for (const fn of ["listAnniversaries", "listBirthdays", "listWeddings"] as const) {
  const a = await LeaveController.listLeaveRequests(admin.id, "admin");
  assert.equal(a.some((r: any) => r.employeeId === prot.id), false);
  const s = await LeaveController.listLeaveRequests(superAdmin.id, "super_admin");
    assert.equal(s.some((r: any) => r.id === prot.id), true, `${fn} hidden from super admin`);
  }
});

test("goals of protected users are hidden from admins, visible to super admins and self", async () => {
  const a = await LeaveController.listLeaveRequests(admin.id, "admin");
  assert.equal(a.some((r: any) => r.employeeId === prot.id), false);
  const s = await LeaveController.listLeaveRequests(superAdmin.id, "super_admin");
  assert.equal(s.some((g: any) => g.userId === prot.id), true);
  const self = await GoalController.getAll({ userRole: "employee", currentUserId: prot.id });
  assert.equal(self.some((g: any) => g.userId === prot.id), true);
});

test("appraisals of protected users: list and detail hidden from admins, visible to super admins", async () => {
  const a = await LeaveController.listLeaveRequests(admin.id, "admin");
  assert.equal(a.some((r: any) => r.employeeId === prot.id), false);
  const s = await LeaveController.listLeaveRequests(superAdmin.id, "super_admin");
  assert.equal(s.some((x: any) => x.employeeId === prot.id), true);

  const adminDetail = await AppraisalController.getById(appraisal.id, { id: admin.id, role: "admin" });
  assert.equal(adminDetail, null);
  const superDetail = await AppraisalController.getById(appraisal.id, { id: superAdmin.id, role: "super_admin" });

  const blockedCreate = await GoalController.create({ title: "x", userId: prot.id }, { id: admin.id, role: "admin" });
  const a = await LeaveController.listLeaveRequests(admin.id, "admin");
  assert.equal(a.some((r: any) => r.employeeId === prot.id), false);
  const s = await LeaveController.listLeaveRequests(superAdmin.id, "super_admin");
  assert.equal(s.some((r: any) => r.employeeId === prot.id), true);

  const aBal = await LeaveController.getTeamBalance(admin.id, "admin");
  assert.equal(aBal.employees.some((e: any) => e.id === prot.id), false);
  const sBal = await LeaveController.getTeamBalance(superAdmin.id, "super_admin");
  assert.equal(sBal.employees.some((e: any) => e.id === prot.id), true);
});

  const blockedUpdate = await GoalController.update(goal.id, { title: "renamed" }, { id: admin.id, role: "admin" });

  const blockedAppraisal = await AppraisalController.create({
    cycleId: cycle?.id ?? 1, employeeId: prot.id, reviewerIds: [admin.id], workflowType: "admin_approval",
  }, { id: admin.id, role: "admin" });

  const employee = await User.findOne({ where: { role: "employee", isProtected: false } });

  const superUpdate = await GoalController.update(goal.id, { title: "renamed by super" }, { id: superAdmin.id, role: "super_admin" });

  const selfUpdate = await GoalController.update(goal.id, { title: "renamed by self" }, { id: prot.id, role: "employee" });

    const updated = await LeaveController.updateLeaveRequest(row.id, admin.id, "admin", { status: "cancelled" });

    const { LeaveApprover } = await import("../models/index.js");

  const { enriched, row } = created as any;

    const prevRows = await LeaveController.getActiveHrApproverRows();

      const superList = await LeaveController.listHrLeaveApprovers({ id: superAdmin.id, role: "super_admin" });

    const updEnriched: any = (updated as any).data;

      const adminList = await LeaveController.listHrLeaveApprovers({ id: admin.id, role: "admin" });

  const created = await LeaveController.createLeaveRequest(employee!.id, {
    leaveType: "annual", startDate: "2026-10-05", endDate: "2026-10-06",
    approverIds: [prot.id, admin.id], coverUserIds: [prot.id], includeHrApprover: false,
  }, "employee");
