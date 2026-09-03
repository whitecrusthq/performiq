import test from "node:test";
import assert from "node:assert/strict";
import User from "../models/User.js";
import { ListCoworkersAction } from "../actions/users/ListCoworkersAction.js";

test("coworkers collection route runs before user-record access middleware", async () => {
  process.env.JWT_SECRET ||= "users-coworkers-route-test-secret";
  const router: any = (await import("./users.js")).default;
  const coworkersIndex = router.stack.findIndex((layer: any) => layer.route?.path === "/users/coworkers");
  const recordGuardIndex = router.stack.findIndex((layer: any) =>
    layer.name === "requireUserRecordAccess" && layer.matchers?.[0]?.("/users/coworkers"),
  );
  assert.ok(coworkersIndex >= 0, "coworkers route is registered");
  assert.ok(recordGuardIndex >= 0, "record guard is registered");
  assert.ok(coworkersIndex < recordGuardIndex, "named collection route must run before /users/:id guards");
});

test("employee coworker lists exclude inactive, locked, and protected accounts", async () => {
  const originalFindAll = User.findAll;
  let where: any;
  try {
    (User.findAll as any) = async (options: any) => {
      where = options.where;
      return [];
    };
    const response: any = { json() {}, status() { return this; } };
    await ListCoworkersAction.handle({ user: { id: 4, role: "employee" } } as any, response);
    assert.deepEqual(where, { isLocked: false, isActive: true, isProtected: false });
  } finally {
    (User.findAll as any) = originalFindAll;
  }
});