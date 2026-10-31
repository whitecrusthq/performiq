import test from "node:test";
import assert from "node:assert/strict";
import { Op } from "sequelize";
import StaffEmailController, { normalizeFilters, personalize } from "./StaffEmailController.js";
import { CustomRole, User, Site, NotificationSettings, StaffEmailCampaign, AppSettings } from "../models/index.js";

function fakeResponse() {
  return {
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    json() { return this; },
  } as any;
}

test("staff email access: admins and HR roles allowed, base managers and other custom roles denied", async () => {
  process.env.JWT_SECRET ||= "staff-email-test-secret";
  const { requireStaffEmailAccess } = await import("../middlewares/auth.js");
  const originalUserFind = User.findByPk;
  const originalRoleFind = CustomRole.findByPk;
  const check = async (actor: any, role: any) => {
    (User.findByPk as any) = async () => actor;
    (CustomRole.findByPk as any) = async () => role;
    let allowed = false;
    const res = fakeResponse();
    await requireStaffEmailAccess({ user: { id: actor?.id ?? 1, role: "employee" } } as any, res, () => { allowed = true; });
    return allowed;
  };
  try {
    assert.equal(await check({ id: 1, role: "admin", isActive: true }, null), true);
    assert.equal(await check({ id: 1, role: "super_admin", isActive: true }, null), true);
    assert.equal(await check({ id: 1, role: "admin", isActive: false }, null), false);
    assert.equal(await check({ id: 1, role: "manager", customRoleId: null, isActive: true }, null), false);
    assert.equal(await check({ id: 1, role: "employee", customRoleId: 3, isActive: true },
      { name: "Payroll", menuPermissions: JSON.stringify(["staff-emails"]) }), true);
    assert.equal(await check({ id: 1, role: "employee", customRoleId: 3, isActive: true },
      { name: "HR Manager", menuPermissions: "[]" }), true);
    assert.equal(await check({ id: 1, role: "employee", customRoleId: 3, isActive: true },
      { name: "HR Manager", menuPermissions: JSON.stringify(["staff"]) }), false);
    assert.equal(await check({ id: 1, role: "manager", customRoleId: 3, isActive: true },
      { name: "Supervisor", menuPermissions: "[]" }), false);
  } finally {
    (User.findByPk as any) = originalUserFind;
    (CustomRole.findByPk as any) = originalRoleFind;
  }
});

test("filters are normalised: unknown keys, blanks, duplicates and bad ids dropped", () => {
  const f = normalizeFilters({
    departments: ["Pharmacy", " Pharmacy ", "", null],
    siteIds: [2, "2", -1, "abc", 3.5],
    roles: [],
    bogus: ["x"],
  });
  assert.deepEqual(f, { departments: ["Pharmacy"], siteIds: [2] });
  assert.deepEqual(normalizeFilters(undefined), {});
});

test("placeholders are filled per recipient and unknown ones left untouched", () => {
  const u = { name: "Ada Obi", firstName: null, department: "Finance", jobTitle: "Analyst", staffId: "MP-7" };
  assert.equal(
    personalize("Hi {{firstName}} ({{ name }}) in {{department}}, {{JOBTITLE}} {{staffId}} {{unknown}}", u),
    "Hi Ada (Ada Obi) in Finance, Analyst MP-7 {{unknown}}",
  );
});

test("recipient query only targets active staff and combines filters, intersecting site and category", async () => {
  const originalUserFindAll = User.findAll;
  const originalSiteFindAll = Site.findAll;
  let userWhere: any;
  try {
    (Site.findAll as any) = async (opts: any) => opts?.where
      ? [{ id: 2 }, { id: 5 }]
      : [{ id: 2, name: "Ikeja" }, { id: 5, name: "Lekki" }];
    (User.findAll as any) = async (opts: any) => {
      userWhere = opts.where;
      return [{ id: 9, name: "Ada", email: "ada@example.test", siteId: 2 }];
    };
    const result = await StaffEmailController.findRecipients({
      departments: ["Pharmacy"], gradeIds: [4], siteIds: [2, 7], siteCategories: ["Retail"],
    });
    assert.equal(userWhere.isActive, true);
    assert.deepEqual(userWhere.department, { [Op.in]: ["Pharmacy"] });
    assert.deepEqual(userWhere.gradeId, { [Op.in]: [4] });
    assert.deepEqual(userWhere.siteId, { [Op.in]: [2] });
    assert.equal(result[0].siteName, "Ikeja");

    await StaffEmailController.findRecipients({}, "super_admin");
    assert.deepEqual(Object.keys(userWhere).sort(), ["email", "isActive"]);

    // Protected accounts stay hidden from everyone below super admin.
    for (const role of ["admin", "manager", "employee", undefined]) {
      await StaffEmailController.findRecipients({}, role);
      assert.equal(userWhere.isProtected, false, `role ${role}`);
    }
  } finally {
    (User.findAll as any) = originalUserFindAll;
    (Site.findAll as any) = originalSiteFindAll;
  }
});

test("send validates input and refuses when no email provider is configured", async () => {
  const originalSettings = NotificationSettings.findAll;
  const savedEnv = { ...process.env };
  try {
    for (const k of ["MAILGUN_API_KEY", "MAILGUN_DOMAIN", "MAILGUN_SMTP_USERNAME", "MAILGUN_SMTP_PASSWORD"]) delete process.env[k];
    (NotificationSettings.findAll as any) = async () => [];
    assert.equal(((await StaffEmailController.send({ id: 1, role: "admin" }, { subject: "", body: "x" })) as any).status, 400);
    assert.equal(((await StaffEmailController.send({ id: 1, role: "admin" }, { subject: "x", body: " " })) as any).status, 400);
    assert.equal(((await StaffEmailController.send({ id: 1, role: "admin" }, { subject: "x".repeat(201), body: "x" })) as any).status, 400);
    const noProvider: any = await StaffEmailController.send({ id: 1, role: "admin" }, { subject: "Hello", body: "Body" });
    assert.equal(noProvider.status, 400);
    assert.match(noProvider.error, /No email provider/);
  } finally {
    (NotificationSettings.findAll as any) = originalSettings;
    process.env = savedEnv;
  }
});

test("send ignores hand-picked ids outside the filtered audience and records delivery failures", async () => {
  const originals = {
    settings: NotificationSettings.findAll,
    userFindAll: User.findAll,
    siteFindAll: Site.findAll,
    create: StaffEmailCampaign.create,
    update: StaffEmailCampaign.update,
    app: AppSettings.findByPk,
  };
  let created: any;
  let finalUpdate: any;
  try {
    // An SMTP provider on a closed local port: every delivery fails fast and nothing leaves the machine.
    (NotificationSettings.findAll as any) = async () => [
      { platform: "smtp", config: { host: "127.0.0.1", port: "1", encryption: "none" } },
    ];
    (Site.findAll as any) = async () => [];
    (User.findAll as any) = async () => [
      { id: 1, name: "Ada", email: "ada@example.test" },
      { id: 2, name: "Bola", email: "bola@example.test" },
    ];
    (AppSettings.findByPk as any) = async () => ({ companyName: "MedPlus" });
    (StaffEmailCampaign.create as any) = async (data: any) => { created = data; return { id: 77, ...data, failures: [], sentCount: 0, failedCount: 0 }; };
    const done = new Promise<void>(resolve => {
      (StaffEmailCampaign.update as any) = async (data: any) => { finalUpdate = data; resolve(); return [1]; };
    });

    const result: any = await StaffEmailController.send({ id: 5, role: "admin" }, {
      subject: "Notice\r\nBcc: attacker@example.test", body: "Hi {{firstName}}", filters: { departments: ["Pharmacy"] }, userIds: [2, 999],
    });
    assert.equal(result.data.recipientCount, 1);
    assert.equal(created.recipientCount, 1);
    assert.equal(created.sentById, 5);
    assert.equal(created.subject, "Notice Bcc: attacker@example.test");
    assert.deepEqual(created.filters, { departments: ["Pharmacy"], selectedOnly: true });

    await done;
    assert.equal(finalUpdate.sentCount, 0);
    assert.equal(finalUpdate.failedCount, 1);
    assert.equal(finalUpdate.status, "failed");
    assert.equal(finalUpdate.failures[0].email, "bola@example.test");

    const none: any = await StaffEmailController.send({ id: 5, role: "admin" }, { subject: "x", body: "y", userIds: [999] });
    assert.equal(none.status, 400);
  } finally {
    (NotificationSettings.findAll as any) = originals.settings;
    (User.findAll as any) = originals.userFindAll;
    (Site.findAll as any) = originals.siteFindAll;
    (StaffEmailCampaign.create as any) = originals.create;
    (StaffEmailCampaign.update as any) = originals.update;
    (AppSettings.findByPk as any) = originals.app;
  }
});

test("access check records the current database role for downstream handlers", async () => {
  process.env.JWT_SECRET ||= "staff-email-test-secret";
  const { requireStaffEmailAccess } = await import("../middlewares/auth.js");
  const original = User.findByPk;
  try {
    // Token still claims super_admin, but the account has since been demoted to admin.
    (User.findByPk as any) = async () => ({ id: 4, role: "admin", isActive: true });
    const req: any = { user: { id: 4, role: "super_admin" } };
    let allowed = false;
    await requireStaffEmailAccess(req, fakeResponse(), () => { allowed = true; });
    assert.equal(allowed, true);
    assert.deepEqual(req.staffEmailActor, { id: 4, role: "admin" });
  } finally {
    (User.findByPk as any) = original;
  }
});

test("history hides protected addresses from failure lists below super admin", async () => {
  const originals = { find: StaffEmailCampaign.findAll, users: User.findAll };
  try {
    (StaffEmailCampaign.findAll as any) = async () => [{
      id: 1, subject: "s", body: "b", filters: {}, recipientCount: 2, sentCount: 0, failedCount: 2,
      failures: [{ email: "VIP@example.test", error: "x" }, { email: "ada@example.test", error: "y" }],
      status: "failed", sentById: null, createdAt: new Date(), completedAt: new Date(),
    }];
    (User.findAll as any) = async (opts: any) => opts?.where?.isProtected ? [{ email: "vip@example.test" }] : [];
    const asAdmin: any = await StaffEmailController.history("admin");
    assert.deepEqual(asAdmin[0].failures.map((f: any) => f.email), ["ada@example.test"]);
    const asSuper: any = await StaffEmailController.history("super_admin");
    assert.equal(asSuper[0].failures.length, 2);
  } finally {
    (StaffEmailCampaign.findAll as any) = originals.find;
    (User.findAll as any) = originals.users;
  }
});
