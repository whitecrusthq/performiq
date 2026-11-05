import test from "node:test";
import assert from "node:assert/strict";
import { requireAdminOrMenu } from "./auth.js";
import { CustomRole, User } from "../models/index.js";

async function run(user: any, menus: string[] | null, key = "departments") {
  const originals = { u: User.findByPk, r: CustomRole.findByPk };
  (User.findByPk as any) = async () => user;
  (CustomRole.findByPk as any) = async () => (menus ? { id: 3, menuPermissions: JSON.stringify(menus) } : null);
  let status = 200, passed = false;
  const res: any = { status(c: number) { status = c; return this; }, json() { return this; } };
  try {
    await requireAdminOrMenu(key)({ user: { id: user?.id ?? 1 } } as any, res, () => { passed = true; });
  } finally {
    (User.findByPk as any) = originals.u;
    (CustomRole.findByPk as any) = originals.r;
  }
  return passed ? 200 : status;
}

test("admin-or-menu: admins and super admins pass", async () => {
  assert.equal(await run({ id: 1, role: "admin", isActive: true }, null), 200);
  assert.equal(await run({ id: 2, role: "super_admin", isActive: true }, null), 200);
});

test("admin-or-menu: a custom role passes only for the ticked menu", async () => {
  const u = { id: 7, role: "employee", isActive: true, customRoleId: 3 };
  assert.equal(await run(u, ["departments"]), 200);
  assert.equal(await run(u, ["departments"], "reports"), 403);
  assert.equal(await run(u, []), 403);
});

test("admin-or-menu: no custom role, inactive or missing accounts are refused", async () => {
  assert.equal(await run({ id: 7, role: "manager", isActive: true, customRoleId: null }, ["departments"]), 403);
  assert.equal(await run({ id: 7, role: "employee", isActive: false, customRoleId: 3 }, ["departments"]), 403);
  assert.equal(await run({ id: 1, role: "admin", isActive: false }, null), 403);
  assert.equal(await run(null, ["departments"]), 403);
});

test("admin-or-menu: only real admins are flagged as full admins", async () => {
  const flag = async (user: any, menus: string[] | null) => {
    const originals = { u: User.findByPk, r: CustomRole.findByPk };
    (User.findByPk as any) = async () => user;
    (CustomRole.findByPk as any) = async () => (menus ? { id: 3, menuPermissions: JSON.stringify(menus) } : null);
    const req: any = { user: { id: user.id } };
    try {
      await requireAdminOrMenu("sites")(req, { status() { return this; }, json() { return this; } } as any, () => {});
    } finally {
      (User.findByPk as any) = originals.u;
      (CustomRole.findByPk as any) = originals.r;
    }
    return req.isFullAdmin === true;
  };
  assert.equal(await flag({ id: 1, role: "admin", isActive: true }, null), true);
  assert.equal(await flag({ id: 2, role: "super_admin", isActive: true }, null), true);
  assert.equal(await flag({ id: 7, role: "employee", isActive: true, customRoleId: 3 }, ["sites"]), false);
});
