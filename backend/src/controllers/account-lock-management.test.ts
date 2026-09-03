import test from "node:test";
import assert from "node:assert/strict";
import { Op } from "sequelize";
import SecurityController from "./SecurityController.js";
import { CustomRole, User, sequelize } from "../models/index.js";

test("account-lock access requires an explicit current custom-role permission", async () => {
  process.env.JWT_SECRET ||= "account-lock-management-test-secret";
  const { requireAccountLockManagementAccess } = await import("../middlewares/auth.js");
  const originalUserFind = User.findByPk;
  const originalRoleFind = CustomRole.findByPk;
  try {
    (User.findByPk as any) = async () => ({ id: 5, role: "manager", customRoleId: 9, isActive: true });
    (CustomRole.findByPk as any) = async () => ({
      id: 9,
      menuPermissions: JSON.stringify(["account-lock-management"]),
    });

    let allowed = false;
    const response: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json() { return this; },
    };
    await requireAccountLockManagementAccess(
      { user: { id: 5, role: "employee" } } as any,
      response,
      () => { allowed = true; },
    );
    assert.equal(allowed, true);

    (CustomRole.findByPk as any) = async () => ({ id: 9, menuPermissions: JSON.stringify(["leave"]) });
    allowed = false;
    response.statusCode = 200;
    await requireAccountLockManagementAccess(
      { user: { id: 5, role: "admin" } } as any,
      response,
      () => { allowed = true; },
    );
    assert.equal(allowed, false);
    assert.equal(response.statusCode, 403);
  } finally {
    (User.findByPk as any) = originalUserFind;
    (CustomRole.findByPk as any) = originalRoleFind;
  }
});

test("non-super-admin lock managers cannot list or unlock protected accounts", async () => {
  const originalFindByPk = User.findByPk;
  const originalFindAll = User.findAll;
  const originalUpdate = User.update;
  let listWhere: any;
  let updateCalled = false;
  try {
    (User.findByPk as any) = async (id: number) => id === 5
      ? { id: 5, role: "manager" }
      : { id, role: "super_admin", isProtected: true, isLocked: true };
    (User.findAll as any) = async (options: any) => { listWhere = options.where; return []; };
    (User.update as any) = async () => { updateCalled = true; return [1, []]; };

    await SecurityController.getLockedAccounts(5);
    assert.equal(listWhere.isProtected, false);
    assert.equal(listWhere.role[Op.ne], "super_admin");

    assert.deepEqual(
      await SecurityController.unlockAccount(1, 5),
      { error: "Locked account not found", status: 404 },
    );
    assert.equal(updateCalled, false);
  } finally {
    (User.findByPk as any) = originalFindByPk;
    (User.findAll as any) = originalFindAll;
    (User.update as any) = originalUpdate;
  }
});

test("bulk unlock updates all validated locked accounts atomically", async () => {
  const originalFindByPk = User.findByPk;
  const originalFindAll = User.findAll;
  const originalUpdate = User.update;
  const originalTransaction = sequelize.transaction;
  const updates: any[] = [];
  try {
    (User.findByPk as any) = async () => ({ id: 5, role: "manager" });
    (User.findAll as any) = async () => [
      { id: 10, role: "employee", isProtected: false },
      { id: 11, role: "manager", isProtected: false },
    ];
    (User.update as any) = async (...args: any[]) => { updates.push(args); return [2]; };
    (sequelize.transaction as any) = async (callback: any) => callback({ LOCK: { UPDATE: "UPDATE" } });

    assert.deepEqual(
      await SecurityController.bulkUnlockAccounts([10, 11], 5),
      { data: { updated: 2 } },
    );
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0][1].where.id[Op.in], [10, 11]);
  } finally {
    (User.findByPk as any) = originalFindByPk;
    (User.findAll as any) = originalFindAll;
    (User.update as any) = originalUpdate;
    (sequelize.transaction as any) = originalTransaction;
  }
});