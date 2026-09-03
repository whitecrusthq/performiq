import test from "node:test";
import assert from "node:assert/strict";
import UserController from "./UserController.js";
import { EmployeeGrade, User, sequelize } from "../models/index.js";

test("bulk grade assignment validates the grade and updates every selected user atomically", async () => {
  const originalGradeFind = EmployeeGrade.findByPk;
  const originalUserFind = User.findAll;
  const originalUserUpdate = User.update;
  const originalTransaction = sequelize.transaction;
  const updates: any[] = [];

  try {
    (EmployeeGrade.findByPk as any) = async (id: number) => id === 4 ? { id: 4 } : null;
    (User.findAll as any) = async () => [
      { id: 10, role: "employee", isProtected: false },
      { id: 11, role: "manager", isProtected: false },
    ];
    (User.update as any) = async (...args: any[]) => { updates.push(args); return [2]; };
    (sequelize.transaction as any) = async (callback: any) => callback({ LOCK: { UPDATE: "UPDATE" } });

    const result = await UserController.bulkAssignGrade([10, 11], 4, "admin");
    assert.deepEqual(result, { data: { updated: 2, gradeId: 4 } });
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0][0], { gradeId: 4 });
    assert.deepEqual(updates[0][1].where, { id: [10, 11] });
  } finally {
    (EmployeeGrade.findByPk as any) = originalGradeFind;
    (User.findAll as any) = originalUserFind;
    (User.update as any) = originalUserUpdate;
    (sequelize.transaction as any) = originalTransaction;
  }
});

test("ordinary admins cannot bulk-update protected accounts", async () => {
  const originalGradeFind = EmployeeGrade.findByPk;
  const originalUserFind = User.findAll;
  const originalUserUpdate = User.update;
  const originalTransaction = sequelize.transaction;
  let updateCalled = false;

  try {
    (EmployeeGrade.findByPk as any) = async () => ({ id: 4 });
    (User.findAll as any) = async () => [{ id: 10, role: "admin", isProtected: true }];
    (User.update as any) = async () => { updateCalled = true; return [1]; };
    (sequelize.transaction as any) = async (callback: any) => callback({ LOCK: { UPDATE: "UPDATE" } });

    const result = await UserController.bulkAssignGrade([10], 4, "admin");
    assert.deepEqual(result, {
      error: "Only a Super Admin can update protected or Super Admin accounts",
      status: 403,
    });
    assert.equal(updateCalled, false);
  } finally {
    (EmployeeGrade.findByPk as any) = originalGradeFind;
    (User.findAll as any) = originalUserFind;
    (User.update as any) = originalUserUpdate;
    (sequelize.transaction as any) = originalTransaction;
  }
});