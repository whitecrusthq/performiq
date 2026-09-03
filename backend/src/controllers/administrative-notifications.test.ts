import test from "node:test";
import assert from "node:assert/strict";
import AdministrativeNotificationController from "./AdministrativeNotificationController.js";
import { sendAdministrativeNotification } from "../lib/administrative-notifications.js";
import { NotificationAdminRecipient, User, sequelize } from "../models/index.js";

test("administrative recipient management rechecks current Super Admin status", async () => {
  process.env.JWT_SECRET ||= "administrative-notifications-test-secret";
  const { requireCurrentSuperAdmin } = await import("../middlewares/auth.js");
  const originalFindByPk = User.findByPk;
  try {
    (User.findByPk as any) = async () => ({ role: "admin", isActive: true });
    let allowed = false;
    const response: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json() { return this; },
    };
    await requireCurrentSuperAdmin(
      { user: { id: 1, role: "super_admin" } } as any,
      response,
      () => { allowed = true; },
    );
    assert.equal(allowed, false);
    assert.equal(response.statusCode, 403);
  } finally {
    (User.findByPk as any) = originalFindByPk;
  }
});

test("administrative recipient updates validate eligibility and save a deduplicated list", async () => {
  const originalCount = User.count;
  const originalDestroy = NotificationAdminRecipient.destroy;
  const originalBulkCreate = NotificationAdminRecipient.bulkCreate;
  const originalTransaction = sequelize.transaction;
  const created: any[] = [];
  let destroyed = false;
  try {
    (User.count as any) = async () => 2;
    (NotificationAdminRecipient.destroy as any) = async () => { destroyed = true; return 2; };
    (NotificationAdminRecipient.bulkCreate as any) = async (rows: any[]) => { created.push(...rows); return rows; };
    (sequelize.transaction as any) = async (callback: any) => callback({});

    assert.deepEqual(
      await AdministrativeNotificationController.update([4, 4, 7], 1),
      { data: { selectedIds: [4, 7] } },
    );
    assert.equal(destroyed, true);
    assert.deepEqual(created, [
      { userId: 4, createdById: 1 },
      { userId: 7, createdById: 1 },
    ]);

    (User.count as any) = async () => 1;
    assert.deepEqual(
      await AdministrativeNotificationController.update([4, 7], 1),
      { error: "Only active Admin and Super Admin users can receive administrative alerts", status: 400 },
    );
  } finally {
    (User.count as any) = originalCount;
    (NotificationAdminRecipient.destroy as any) = originalDestroy;
    (NotificationAdminRecipient.bulkCreate as any) = originalBulkCreate;
    (sequelize.transaction as any) = originalTransaction;
  }
});

test("administrative recipient list exposes only minimal administrator details and selection state", async () => {
  const originalUserFindAll = User.findAll;
  const originalRecipientFindAll = NotificationAdminRecipient.findAll;
  try {
    (User.findAll as any) = async () => [
      { id: 4, name: "Admin One", email: "one@example.test", role: "admin", isProtected: false },
      { id: 7, name: "Admin Two", email: "two@example.test", role: "super_admin", isProtected: true },
    ];
    (NotificationAdminRecipient.findAll as any) = async () => [{ userId: 7 }];

    assert.deepEqual(await AdministrativeNotificationController.list(), [
      { id: 4, name: "Admin One", email: "one@example.test", role: "admin", isProtected: false, selected: false },
      { id: 7, name: "Admin Two", email: "two@example.test", role: "super_admin", isProtected: true, selected: true },
    ]);
  } finally {
    (User.findAll as any) = originalUserFindAll;
    (NotificationAdminRecipient.findAll as any) = originalRecipientFindAll;
  }
});

test("no administrative email is sent when no recipients are configured", async () => {
  const originalRecipientFindAll = NotificationAdminRecipient.findAll;
  const originalUserFindAll = User.findAll;
  let queriedUsers = false;
  try {
    (NotificationAdminRecipient.findAll as any) = async () => [];
    (User.findAll as any) = async () => { queriedUsers = true; return []; };
    assert.equal(await sendAdministrativeNotification({ subject: "Test", text: "Test alert" }), 0);
    assert.equal(queriedUsers, false);
  } finally {
    (NotificationAdminRecipient.findAll as any) = originalRecipientFindAll;
    (User.findAll as any) = originalUserFindAll;
  }
});