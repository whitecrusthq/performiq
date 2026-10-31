import test from "node:test";
import assert from "node:assert/strict";
import NotificationSettingsController, { redactSettings } from "./NotificationSettingsController.js";
import { NotificationSettings, User } from "../models/index.js";

const fakeResponse = () => ({
  statusCode: 200,
  status(code: number) { this.statusCode = code; return this; },
  json() { return this; },
}) as any;

test("settings never return secret values, only which secrets are set", async () => {
  const original = NotificationSettings.findAll;
  try {
    (NotificationSettings.findAll as any) = async () => [
      { platform: "mailgun", enabled: true, config: { authMode: "api", apiKey: "key-123", domain: "mg.example.test", password: "" } },
      { platform: "gmail", enabled: false, config: { username: "hr@example.test", password: "abcdabcdabcdabcd" } },
      { platform: "firebase", enabled: false, config: { projectId: "p", serviceAccountJson: "{\"private_key\":\"x\"}" } },
    ];
    const all = await NotificationSettingsController.getAll();
    const body = JSON.stringify(all);
    for (const secret of ["key-123", "abcdabcdabcdabcd", "private_key"]) assert.equal(body.includes(secret), false, secret);
    assert.deepEqual(all.mailgun.config, { authMode: "api", domain: "mg.example.test" });
    assert.deepEqual(all.mailgun.secretsSet, ["apiKey"]);
    assert.deepEqual(all.gmail.secretsSet, ["password"]);
    assert.equal(all.gmail.config.username, "hr@example.test");
    assert.deepEqual(all.smtp.secretsSet, []);
  } finally {
    (NotificationSettings.findAll as any) = original;
  }
});

test("saving with blank secrets keeps the stored ones; new values replace them", async () => {
  const originals = { findOne: NotificationSettings.findOne, update: NotificationSettings.update };
  let saved: any;
  try {
    (NotificationSettings.findOne as any) = async () => ({
      enabled: true,
      config: { username: "old@example.test", password: "stored-app-password", fromName: "HR" },
    });
    (NotificationSettings.update as any) = async (data: any) => { saved = data; return [1, [{ platform: "gmail", enabled: true, config: data.config }]]; };

    const kept: any = await NotificationSettingsController.updatePlatform("gmail", {
      enabled: true, config: { username: "new@example.test", password: "", fromName: "People Team" },
    }, 1);
    assert.equal(saved.config.password, "stored-app-password");
    assert.equal(saved.config.username, "new@example.test");
    assert.equal(JSON.stringify(kept).includes("stored-app-password"), false, "response must not echo the secret");
    assert.deepEqual(kept.data.secretsSet, ["password"]);

    await NotificationSettingsController.updatePlatform("gmail", { config: { username: "new@example.test" } }, 1);
    assert.equal(saved.config.password, "stored-app-password", "omitted secret is kept");

    await NotificationSettingsController.updatePlatform("gmail", { config: { username: "new@example.test", password: "brand-new" } }, 1);
    assert.equal(saved.config.password, "brand-new");
  } finally {
    (NotificationSettings.findOne as any) = originals.findOne;
    (NotificationSettings.update as any) = originals.update;
  }
});

test("redaction works on plain objects too", () => {
  const r = redactSettings({ platform: "slack", config: { webhookUrl: "https://hooks.example.test", botToken: "xoxb" } });
  assert.deepEqual(r.config, { webhookUrl: "https://hooks.example.test" });
  assert.deepEqual(r.secretsSet, ["botToken"]);
});

test("notification settings access uses the current database role, not the token", async () => {
  process.env.JWT_SECRET ||= "notification-settings-test-secret";
  const { requireCurrentAdmin } = await import("../middlewares/auth.js");
  const original = User.findByPk;
  const check = async (actor: any, tokenRole: string) => {
    (User.findByPk as any) = async () => actor;
    let allowed = false;
    const res = fakeResponse();
    await requireCurrentAdmin({ user: { id: 3, role: tokenRole } } as any, res, () => { allowed = true; });
    return { allowed, status: res.statusCode };
  };
  try {
    assert.equal((await check({ id: 3, role: "admin", isActive: true }, "admin")).allowed, true);
    assert.equal((await check({ id: 3, role: "super_admin", isActive: true }, "super_admin")).allowed, true);
    // Demoted since the token was issued.
    assert.deepEqual(await check({ id: 3, role: "employee", isActive: true }, "admin"), { allowed: false, status: 403 });
    // Deactivated admin.
    assert.deepEqual(await check({ id: 3, role: "admin", isActive: false }, "admin"), { allowed: false, status: 403 });
    assert.deepEqual(await check(null, "admin"), { allowed: false, status: 403 });
  } finally {
    (User.findByPk as any) = original;
  }
});

test("every admin notification-settings route is behind the database-backed admin check", async () => {
  const { default: router } = await import("../routes/notification-settings.js");
  const { requireCurrentAdmin, requireCurrentSuperAdmin } = await import("../middlewares/auth.js");
  const layers = (router as any).stack.filter((l: any) => l.route);
  assert.ok(layers.length >= 6);
  for (const l of layers) {
    const handlers = l.route.stack.map((s: any) => s.handle);
    const guarded = handlers.includes(requireCurrentAdmin) || handlers.includes(requireCurrentSuperAdmin);
    assert.ok(guarded, `${Object.keys(l.route.methods)} ${l.route.path}`);
  }
});
