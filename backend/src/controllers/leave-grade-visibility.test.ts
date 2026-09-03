import test from "node:test";
import assert from "node:assert/strict";
import LeaveController from "./LeaveController.js";
import { LeaveAllocation, LeavePolicy, LeaveType, LeaveTypeGrade, User } from "../models/index.js";

test("employee policies and balances exclude leave mapped to another grade", async () => {
  const originalTypeFindAll = LeaveType.findAll;
  const originalMappingFindAll = LeaveTypeGrade.findAll;
  const originalUserFindByPk = User.findByPk;
  const originalPolicyFindAll = LeavePolicy.findAll;
  const originalAllocationFindAll = LeaveAllocation.findAll;
  const originalEnsureAllocation = LeaveController.ensureAllocation;
  const ensured: string[] = [];

  const annualPolicy = {
    leaveType: "annual",
    cycleStartMonth: 1,
    cycleStartDay: 1,
    cycleEndMonth: 12,
    cycleEndDay: 31,
  };
  const executivePolicy = {
    leaveType: "executive",
    cycleStartMonth: 1,
    cycleStartDay: 1,
    cycleEndMonth: 12,
    cycleEndDay: 31,
  };

  try {
    (LeaveType.findAll as any) = async () => [
      { id: 1, name: "annual" },
      { id: 2, name: "executive" },
    ];
    (LeaveTypeGrade.findAll as any) = async () => [{ leaveTypeId: 2, gradeId: 2 }];
    (User.findByPk as any) = async () => ({ id: 10, gradeId: 1 });
    (LeavePolicy.findAll as any) = async () => [annualPolicy, executivePolicy];
    (LeaveController.ensureAllocation as any) = async (_userId: number, leaveType: string) => {
      ensured.push(leaveType);
      return {};
    };
    (LeaveAllocation.findAll as any) = async () => [
      { toJSON: () => ({ employeeId: 10, leaveType: "annual", allocated: 20, used: 2, cycleYear: 2026 }) },
      { toJSON: () => ({ employeeId: 10, leaveType: "executive", allocated: 5, used: 0, cycleYear: 2026 }) },
    ];

    const policies = await LeaveController.listPolicies({ id: 10, role: "employee" });
    assert.deepEqual(policies.map(policy => policy.leaveType), ["annual"]);

    const balance = await LeaveController.getLeaveBalance(10);
    assert.deepEqual(ensured, ["annual"]);
    assert.deepEqual(balance.balances.map(row => row.leaveType), ["annual"]);
  } finally {
    (LeaveType.findAll as any) = originalTypeFindAll;
    (LeaveTypeGrade.findAll as any) = originalMappingFindAll;
    (User.findByPk as any) = originalUserFindByPk;
    (LeavePolicy.findAll as any) = originalPolicyFindAll;
    (LeaveAllocation.findAll as any) = originalAllocationFindAll;
    (LeaveController.ensureAllocation as any) = originalEnsureAllocation;
  }
});

test("unknown leave types are not accepted as unrestricted legacy types", async () => {
  const originalTypeFindOne = LeaveType.findOne;
  try {
    (LeaveType.findOne as any) = async () => null;
    assert.equal(await LeaveController.isLeaveTypeAllowedForUser(10, "unknown_type"), false);
  } finally {
    (LeaveType.findOne as any) = originalTypeFindOne;
  }
});

test("policy creation rejects an unknown leave type", async () => {
  const originalTypeFindOne = LeaveType.findOne;
  try {
    (LeaveType.findOne as any) = async () => null;
    assert.deepEqual(
      await LeaveController.upsertPolicy({ leaveType: "unknown_type", daysAllocated: 10 }),
      { error: "Unknown leave type", status: 400 },
    );
  } finally {
    (LeaveType.findOne as any) = originalTypeFindOne;
  }
});

test("existing automatic allocations refresh when the applicable policy changes", async () => {
  const originalPolicyFindOne = LeavePolicy.findOne;
  const originalUserFindByPk = User.findByPk;
  const originalAllocationFindOne = LeaveAllocation.findOne;
  const updates: any[] = [];
  const existing = {
    allocated: 5,
    policyId: 1,
    isManual: false,
    update: async (values: any) => { updates.push(values); Object.assign(existing, values); },
  };

  try {
    (LeavePolicy.findOne as any) = async () => ({
      id: 2,
      leaveType: "annual",
      daysAllocated: 20,
      prorationMode: "none",
      cycleStartMonth: 1,
      cycleStartDay: 1,
      cycleEndMonth: 12,
      cycleEndDay: 31,
    });
    (User.findByPk as any) = async () => ({ id: 10, startDate: null });
    (LeaveAllocation.findOne as any) = async () => existing;

    const result = await LeaveController.ensureAllocation(10, "annual", 2026);
    assert.equal(result, existing);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].allocated, 20);
    assert.equal(updates[0].policyId, 2);
  } finally {
    (LeavePolicy.findOne as any) = originalPolicyFindOne;
    (User.findByPk as any) = originalUserFindByPk;
    (LeaveAllocation.findOne as any) = originalAllocationFindOne;
  }
});