import { NotificationSettings } from "../models/index.js";

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

export default class NotificationSettingsController {
  static PLATFORMS = PLATFORMS;

  static async getPlatforms() {
    return PLATFORMS;
  }

  static async getAll() {
    const rows = await NotificationSettings.findAll();
    const result: Record<string, any> = {};
    for (const p of PLATFORMS) {
      const existing = rows.find(r => r.platform === p.key);
      result[p.key] = existing ? existing.get({ plain: true }) : { platform: p.key, enabled: false, config: {} };
    }
    return result;
  }

  static async updatePlatform(platform: string, data: { enabled?: boolean; config?: Record<string, any> }, userId: number) {
    const platformDef = PLATFORMS.find(p => p.key === platform);
    if (!platformDef) return { error: "Unknown platform", status: 400 };

    const { enabled, config } = data;
    const safeConfig: Record<string, string> = {};
    if (config && typeof config === "object") {
      for (const field of platformDef.fields) {
        if (config[field] !== undefined) {
          safeConfig[field] = String(config[field]);
        }
      }
    }

    const existing = await NotificationSettings.findOne({ where: { platform } });

    let row;
    if (existing) {
      const [, rows] = await NotificationSettings.update({
        enabled: typeof enabled === "boolean" ? enabled : existing.enabled,
        config: safeConfig,
        updatedAt: new Date(),
        updatedById: String(userId),
      }, { where: { platform }, returning: true });
      row = rows[0];
    } else {
      row = await NotificationSettings.create({
        platform,
        enabled: typeof enabled === "boolean" ? enabled : false,
        config: safeConfig,
        updatedById: String(userId),
      });
    }

    return { data: row };
  }

  static async testPlatform(platform: string) {
    const settings = await NotificationSettings.findOne({ where: { platform } });

    if (!settings || !settings.enabled) {
      return { error: "Platform is not enabled", status: 400 };
    }

    const config = settings.config as Record<string, string>;

    switch (platform) {
      case "mailgun": {
        if (!config.apiKey || !config.domain) return { error: "API Key and Domain are required", status: 400 };
        return { data: { success: true, message: "Mailgun configuration looks valid. A test email would be sent to verify." } };
      }
      case "smtp": {
        if (!config.host || !config.port) return { error: "Host and Port are required", status: 400 };
        return { data: { success: true, message: "SMTP configuration looks valid. A test email would be sent to verify." } };
      }
      case "twilio":
      case "whatsapp": {
        if (!config.accountSid || !config.authToken || !config.fromNumber) return { error: "Account SID, Auth Token, and From Number are required", status: 400 };
        return { data: { success: true, message: `${platform === "twilio" ? "Twilio" : "WhatsApp"} configuration looks valid.` } };
      }
      case "slack": {
        if (!config.webhookUrl && !config.botToken) return { error: "Webhook URL or Bot Token is required", status: 400 };
        return { data: { success: true, message: "Slack configuration looks valid." } };
      }
      case "teams": {
        if (!config.webhookUrl) return { error: "Webhook URL is required", status: 400 };
        return { data: { success: true, message: "Teams webhook configuration looks valid." } };
      }
      case "telegram": {
        if (!config.botToken || !config.chatId) return { error: "Bot Token and Chat ID are required", status: 400 };
        return { data: { success: true, message: "Telegram configuration looks valid." } };
      }
      case "firebase": {
        if (!config.projectId) return { error: "Project ID is required", status: 400 };
        return { data: { success: true, message: "Firebase configuration looks valid." } };
      }
      case "webhook": {
        if (!config.url) return { error: "Webhook URL is required", status: 400 };
        return { data: { success: true, message: "Webhook configuration looks valid." } };
      }
      default:
        return { error: "Unknown platform", status: 400 };
    }
  }
}
