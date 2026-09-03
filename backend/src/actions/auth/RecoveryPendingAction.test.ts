import { test } from "node:test";
import assert from "node:assert/strict";

// This module is intentionally loaded after the secrets are set: auth and the
// Sequelize configuration validate their required environment at import time.
process.env.JWT_SECRET ??= "recovery-pending-test-secret";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

const auth = await import("../../middlewares/auth.js");
const { RecoveryPendingAction } = await import("./RecoveryPendingAction.js");
const { default: User } = await import("../../models/User.js");

test("recovery pending tokens are accepted only from Authorization Bearer", () => {
  const token = auth.generateRecoveryPendingToken({ id: 7, requestId: 9, tokenVersion: 3 });
  const action = RecoveryPendingAction as any;

  assert.equal(action.token({
    headers: { authorization: `Bearer ${token}` },
    body: { pendingToken: "attacker-value" },
    query: { pendingToken: "attacker-value" },
  })?.requestId, 9);

  assert.equal(action.token({
    headers: {},
    body: { pendingToken: token },
    query: { pendingToken: token },
  }), null);
});

test("recovery pending tokens cannot be used as a full session", async () => {
  const token = auth.generateRecoveryPendingToken({ id: 7, requestId: 9, tokenVersion: 3 });
  let status = 0;
  let body: unknown;
  await auth.requireAuth(
    { headers: { authorization: `Bearer ${token}` } } as any,
    { status(code: number) { status = code; return this; }, json(value: unknown) { body = value; return this; } } as any,
    () => assert.fail("pending token must not reach protected handlers"),
  );
  assert.equal(status, 401);
  assert.deepEqual(body, { error: "Invalid token" });
});

test("a session minted before a serialized reset cannot survive its token-version rotation", async () => {
  const token = auth.generateToken({
    id: 7, role: "employee", email: "person@example.test", tokenVersion: 4,
  });
  const originalFindByPk = User.findByPk;
  (User as any).findByPk = async () => ({ id: 7, tokenVersion: 5, isActive: true });
  try {
    let status = 0;
    await auth.requireAuth(
      { headers: { authorization: `Bearer ${token}` } } as any,
      { status(code: number) { status = code; return this; }, json() { return this; } } as any,
      () => assert.fail("the pre-reset JWT must be rejected"),
    );
    assert.equal(status, 401);
  } finally {
    (User as any).findByPk = originalFindByPk;
  }
});