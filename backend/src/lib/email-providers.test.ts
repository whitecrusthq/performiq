import test from "node:test";
import assert from "node:assert/strict";
import { gmailProviderFromConfig, resolveEmailProvider } from "./email.js";
import { NotificationSettings } from "../models/index.js";
import NotificationSettingsController from "../controllers/NotificationSettingsController.js";
import { buildMailgunBatch } from "../controllers/StaffEmailController.js";

test("gmail config becomes an SSL SMTP provider with spaces stripped from the app password", () => {
  const p: any = gmailProviderFromConfig({ username: " hr@example.test ", password: "abcd efgh ijkl mnop", fromName: 'Med"Plus <HR>' });
  assert.equal(p.host, "smtp.gmail.com");
  assert.equal(p.port, 465);
  assert.equal(p.encryption, "ssl");
  assert.equal(p.username, "hr@example.test");
  assert.equal(p.password, "abcdefghijklmnop");
  assert.equal(p.fromEmail, '"MedPlus HR" <hr@example.test>');
  assert.equal(p.label, "Gmail");
  assert.equal(gmailProviderFromConfig({ username: "hr@example.test" }), null);
  assert.equal((gmailProviderFromConfig({ username: "a@b.test", password: "x" }) as any).fromEmail, "a@b.test");
});

test("provider priority is SMTP, then Gmail, then Mailgun, and Mailgun keeps its region", async () => {
  const original = NotificationSettings.findAll;
  const savedEnv = { ...process.env };
  const smtp = { platform: "smtp", config: { host: "mail.example.test", port: "587" } };
  const gmail = { platform: "gmail", config: { username: "hr@example.test", password: "pw" } };
  const mailgun = { platform: "mailgun", config: { apiKey: "key", domain: "mg.example.test", region: "eu" } };
  try {
    for (const k of Object.keys(process.env)) if (k.startsWith("MAILGUN_")) delete process.env[k];
    const resolveWith = async (rows: any[]) => {
      (NotificationSettings.findAll as any) = async () => rows;
      return (await resolveEmailProvider()) as any;
    };
    assert.equal((await resolveWith([mailgun, gmail, smtp])).label, "SMTP");
    assert.equal((await resolveWith([mailgun, gmail])).label, "Gmail");
    const mg = await resolveWith([mailgun]);
    assert.equal(mg.kind, "mailgun");
    assert.equal(mg.region, "eu");
    const mgSmtp = await resolveWith([{ platform: "mailgun", config: { authMode: "smtp", username: "u", password: "p", region: "eu" } }]);
    assert.equal(mgSmtp.host, "smtp.eu.mailgun.org");
    // Gmail enabled without an app password is ignored rather than breaking email.
    assert.equal((await resolveWith([{ platform: "gmail", config: { username: "hr@example.test" } }, mailgun])).label, "Mailgun (API)");
    assert.equal(await resolveWith([]), null);
  } finally {
    (NotificationSettings.findAll as any) = original;
    process.env = savedEnv;
  }
});

test("settings expose Gmail and the Mailgun region field, and Gmail test requires credentials", async () => {
  const platforms = await NotificationSettingsController.getPlatforms();
  assert.deepEqual(platforms.find(p => p.key === "gmail")?.fields, ["username", "password", "fromName"]);
  assert.ok(platforms.find(p => p.key === "mailgun")?.fields.includes("region"));

  const original = NotificationSettings.findOne;
  try {
    (NotificationSettings.findOne as any) = async () => ({ enabled: true, config: { username: "hr@example.test" } });
    const result: any = await NotificationSettingsController.testPlatform("gmail");
    assert.equal(result.status, 400);
    assert.match(result.error, /app password/);
  } finally {
    (NotificationSettings.findOne as any) = original;
  }
});

test("mailgun batches personalise per recipient and escape values in HTML only", () => {
  const batch = buildMailgunBatch(
    [
      { email: "ada@example.test", name: "Ada <b>Obi</b>", department: "R&D" },
      { email: "bola@example.test", name: "Bola", firstName: "Bo", jobTitle: "Pharmacist" },
    ],
    "Hi {{firstName}}",
    "Dear {{ name }},\n<script>x</script> {{unknown}} {{jobTitle}}",
    "MedPlus",
  );
  assert.deepEqual(batch.to, ["ada@example.test", "bola@example.test"]);
  assert.equal(batch.subject, "Hi %recipient.firstname%");
  assert.equal(batch.text, "Dear %recipient.name%,\n<script>x</script> {{unknown}} %recipient.jobtitle%");
  assert.match(batch.html, /Dear %recipient\.name_html%,<br>&lt;script&gt;x&lt;\/script&gt; \{\{unknown\}\} %recipient\.jobtitle_html%/);
  assert.equal(batch.recipientVariables["ada@example.test"].name, "Ada <b>Obi</b>");
  assert.equal(batch.recipientVariables["ada@example.test"].name_html, "Ada &lt;b&gt;Obi&lt;/b&gt;");
  assert.equal(batch.recipientVariables["ada@example.test"].department_html, "R&amp;D");
  assert.equal(batch.recipientVariables["bola@example.test"].firstname, "Bo");
  assert.equal(batch.recipientVariables["ada@example.test"].jobtitle, "");
});
