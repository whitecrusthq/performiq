import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { resolveEmailProvider, sendEmail, gmailProviderFromConfig } from "./email.js";
import { NotificationSettings } from "../models/index.js";
import NotificationSettingsController from "../controllers/NotificationSettingsController.js";

test("each email service carries its Reply-To setting", async () => {
  const original = NotificationSettings.findAll;
  const savedEnv = { ...process.env };
  try {
    for (const k of Object.keys(process.env)) if (k.startsWith("MAILGUN_")) delete process.env[k];
    const withRows = async (rows: any[]) => {
      (NotificationSettings.findAll as any) = async () => rows;
      return (await resolveEmailProvider()) as any;
    };
    assert.equal((await withRows([{ platform: "mailgun", config: { apiKey: "k", domain: "mg.example.test", replyTo: "hr@example.test" } }])).replyTo, "hr@example.test");
    assert.equal((await withRows([{ platform: "mailgun", config: { authMode: "smtp", username: "u", password: "p", replyTo: "hr@example.test" } }])).replyTo, "hr@example.test");
    assert.equal((await withRows([{ platform: "smtp", config: { host: "h", port: "587", replyTo: "hr@example.test" } }])).replyTo, "hr@example.test");
    assert.equal((gmailProviderFromConfig({ username: "a@example.test", password: "p", replyTo: " hr@example.test " }) as any).replyTo, "hr@example.test");
    assert.equal((await withRows([{ platform: "mailgun", config: { apiKey: "k", domain: "d" } }])).replyTo, undefined);

    process.env.MAILGUN_API_KEY = "k"; process.env.MAILGUN_DOMAIN = "d"; process.env.MAILGUN_REPLY_TO = "env@example.test";
    assert.equal((await withRows([])).replyTo, "env@example.test");
  } finally {
    (NotificationSettings.findAll as any) = original;
    process.env = savedEnv;
  }
});

test("SMTP sends include Reply-To only when it is set", async () => {
  const originals = { find: NotificationSettings.findAll, create: (nodemailer as any).createTransport };
  const sent: any[] = [];
  try {
    (nodemailer as any).createTransport = () => ({ sendMail: async (m: any) => { sent.push(m); } });
    (NotificationSettings.findAll as any) = async () => [{ platform: "smtp", config: { host: "h", port: "587", replyTo: "hr@example.test" } }];
    await sendEmail({ to: "a@example.test", subject: "s", html: "h", text: "t" });
    assert.equal(sent[0].replyTo, "hr@example.test");

    (NotificationSettings.findAll as any) = async () => [{ platform: "smtp", config: { host: "h", port: "587" } }];
    await sendEmail({ to: "a@example.test", subject: "s", html: "h", text: "t" });
    assert.equal("replyTo" in sent[1], false);
  } finally {
    (NotificationSettings.findAll as any) = originals.find;
    (nodemailer as any).createTransport = originals.create;
  }
});

test("Reply-To must be one valid address when saved", async () => {
  const originals = { findOne: NotificationSettings.findOne, update: NotificationSettings.update };
  let saved: any = null;
  try {
    (NotificationSettings.findOne as any) = async () => ({ enabled: true, config: { apiKey: "k", domain: "d" } });
    (NotificationSettings.update as any) = async (data: any) => { saved = data; return [1, [{ platform: "mailgun", enabled: true, config: data.config }]]; };
    for (const bad of ["not-an-email", "a@b.test, c@d.test", "HR <hr@example.test>", "hr@example.test\r\nBcc: x@evil.test"]) {
      const r: any = await NotificationSettingsController.updatePlatform("mailgun", { config: { apiKey: "", domain: "d", replyTo: bad } }, 1);
      assert.equal(r.status, 400, JSON.stringify(bad));
    }
    assert.equal(saved, null);
    const ok: any = await NotificationSettingsController.updatePlatform("mailgun", { config: { apiKey: "", domain: "d", replyTo: "  hr@example.test " } }, 1);
    assert.equal(ok.data.config.replyTo, "hr@example.test");
    await NotificationSettingsController.updatePlatform("mailgun", { config: { apiKey: "", domain: "d", replyTo: "" } }, 1);
    assert.equal(saved.config.replyTo, "", "blank clears it");
  } finally {
    (NotificationSettings.findOne as any) = originals.findOne;
    (NotificationSettings.update as any) = originals.update;
  }
});
