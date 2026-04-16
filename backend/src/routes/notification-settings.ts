import { Router } from "express";
import { db, notificationSettingsTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";

const router = Router();

const PLATFORMS = [
  { key: "mailgun", label: "Mailgun", fields: ["apiKey", "domain", "fromEmail"] },
  { key: "smtp", label: "SMTP / Email", fields: ["host", "port", "username", "password", "fromEmail", "encryption"] },
  { key: "twilio", label: "Twilio (SMS)", fields: ["accountSid", "authToken", "fromNumber"] },
  { key: "slack", label: "Slack", fields: ["webhookUrl", "channel", "botToken"] },
  { key: "teams", label: "Microsoft Teams", fields: ["webhookUrl"] },
  { key: "whatsapp", label: "WhatsApp (Twilio)", fields: ["accountSid", "authToken", "fromNumber"] },
  { key: "telegram", label: "Telegram", fields: ["botToken", "chatId"] },
  { key: "firebase", label: "Firebase (Push)", fields: ["serviceAccountJson", "projectId"] },
  { key: "webhook", label: "Custom Webhook", fields: ["url", "method", "headers", "secret"] },
];

router.get("/notification-settings/platforms", requireAuth, requireRole("admin"), async (_req, res) => {
  res.json(PLATFORMS);
});

router.get("/notification-settings", requireAuth, requireRole("admin"), async (_req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(notificationSettingsTable);
    const result: Record<string, any> = {};
    for (const p of PLATFORMS) {
      const existing = rows.find(r => r.platform === p.key);
      result[p.key] = existing || { platform: p.key, enabled: false, config: {} };
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/notification-settings/:platform", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { platform } = req.params;
    const platformDef = PLATFORMS.find(p => p.key === platform);
    if (!platformDef) { res.status(400).json({ error: "Unknown platform" }); return; }

    const { enabled, config } = req.body;
    const safeConfig: Record<string, string> = {};
    if (config && typeof config === "object") {
      for (const field of platformDef.fields) {
        if (config[field] !== undefined) {
          safeConfig[field] = String(config[field]);
        }
      }
    }

    const [existing] = await db.select().from(notificationSettingsTable)
      .where(eq(notificationSettingsTable.platform, platform));

    let row;
    if (existing) {
      [row] = await db.update(notificationSettingsTable).set({
        enabled: typeof enabled === "boolean" ? enabled : existing.enabled,
        config: safeConfig,
        updatedAt: new Date(),
        updatedById: String(req.user!.id),
      }).where(eq(notificationSettingsTable.platform, platform)).returning();
    } else {
      [row] = await db.insert(notificationSettingsTable).values({
        platform,
        enabled: typeof enabled === "boolean" ? enabled : false,
        config: safeConfig,
        updatedById: String(req.user!.id),
      }).returning();
    }

    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/notification-settings/:platform/test", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { platform } = req.params;
    const [settings] = await db.select().from(notificationSettingsTable)
      .where(eq(notificationSettingsTable.platform, platform));

    if (!settings || !settings.enabled) {
      res.status(400).json({ error: "Platform is not enabled" }); return;
    }

    const config = settings.config as Record<string, string>;

    switch (platform) {
      case "mailgun": {
        if (!config.apiKey || !config.domain) {
          res.status(400).json({ error: "API Key and Domain are required" }); return;
        }
        res.json({ success: true, message: "Mailgun configuration looks valid. A test email would be sent to verify." });
        break;
      }
      case "smtp": {
        if (!config.host || !config.port) {
          res.status(400).json({ error: "Host and Port are required" }); return;
        }
        res.json({ success: true, message: "SMTP configuration looks valid. A test email would be sent to verify." });
        break;
      }
      case "twilio":
      case "whatsapp": {
        if (!config.accountSid || !config.authToken || !config.fromNumber) {
          res.status(400).json({ error: "Account SID, Auth Token, and From Number are required" }); return;
        }
        res.json({ success: true, message: `${platform === "twilio" ? "Twilio" : "WhatsApp"} configuration looks valid.` });
        break;
      }
      case "slack": {
        if (!config.webhookUrl && !config.botToken) {
          res.status(400).json({ error: "Webhook URL or Bot Token is required" }); return;
        }
        res.json({ success: true, message: "Slack configuration looks valid." });
        break;
      }
      case "teams": {
        if (!config.webhookUrl) {
          res.status(400).json({ error: "Webhook URL is required" }); return;
        }
        res.json({ success: true, message: "Teams webhook configuration looks valid." });
        break;
      }
      case "telegram": {
        if (!config.botToken || !config.chatId) {
          res.status(400).json({ error: "Bot Token and Chat ID are required" }); return;
        }
        res.json({ success: true, message: "Telegram configuration looks valid." });
        break;
      }
      case "firebase": {
        if (!config.projectId) {
          res.status(400).json({ error: "Project ID is required" }); return;
        }
        res.json({ success: true, message: "Firebase configuration looks valid." });
        break;
      }
      case "webhook": {
        if (!config.url) {
          res.status(400).json({ error: "Webhook URL is required" }); return;
        }
        res.json({ success: true, message: "Webhook configuration looks valid." });
        break;
      }
      default:
        res.status(400).json({ error: "Unknown platform" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
