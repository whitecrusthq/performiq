import test from "node:test";
import assert from "node:assert/strict";
import AccountRecoveryController from "./AccountRecoveryController.js";
import { CustomRole, User } from "../models/index.js";

const people: any[] = [
  { id: 1, name: "Admin", role: "admin", isProtected: false, isActive: true, customRoleId: null },
  { id: 5, name: "Bob", role: "employee", isProtected: false, isActive: true, customRoleId: null },
  { id: 6, name: "Carol", role: "employee", isProtected: false, isActive: true, customRoleId: 11 },
  { id: 7, name: "David", role: "employee", isProtected: false, isActive: true, customRoleId: 11 },
  { id: 8, name: "Erin", role: "manager", isProtected: true, isActive: true, customRoleId: null },
];

function stub(menuPermissions: string[]) {
  const originals = { find: User.findByPk, all: User.findAll, roles: CustomRole.findAll };
  (User.findByPk as any) = async (id: number) => people.find(p => p.id === Number(id)) ?? null;
  // Returns everyone, so the test proves the controller's own filtering.
  (User.findAll as any) = async () => people;
  (CustomRole.findAll as any) = async () => [{ id: 11, menuPermissions: JSON.stringify(menuPermissions) }];
  return () => { (User.findByPk as any) = originals.find; (User.findAll as any) = originals.all; (CustomRole.findAll as any) = originals.roles; };
}

test("account recovery: a custom role granted the menu lists ordinary staff but not other holders", async () => {
  const restore = stub(["account-recovery"]);
  try {
    const ids = (await AccountRecoveryController.list(7)).map(u => u.id);
    assert.deepEqual(ids, [5]);
  } finally { restore(); }
});

test("account recovery: admins still see holders of the custom role", async () => {
  const restore = stub(["account-recovery"]);
  try {
    const ids = (await AccountRecoveryController.list(1)).map(u => u.id);
    assert.deepEqual(ids, [5, 6, 7]);
  } finally { restore(); }
});

test("account recovery: without the menu permission the list is empty", async () => {
  const restore = stub(["dashboard"]);
  try {
    assert.deepEqual(await AccountRecoveryController.list(7), []);
  } finally { restore(); }
});
