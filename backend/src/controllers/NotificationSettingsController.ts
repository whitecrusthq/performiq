import { NotificationSettings } from "../models/index.js";
import { buildSmtpTransport, gmailProviderFromConfig, mailgunClient } from "../lib/email.js";

const PLATFORMS = [
  { key: "mailgun", label: "Mailgun", fields: ["authMode", "region", "apiKey", "domain", "username", "password", "host", "port", "fromEmail", "encryption"] },
  { key: "gmail", label: "Gmail", fields: ["username", "password", "fromName"] },
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
        if (config.authMode === "smtp") {
          if (!config.username || !config.password) {
            return { error: "Mailgun SMTP Username and Password are required", status: 400 };
          }
          try {
            const transporter = buildSmtpTransport({
              kind: "smtp",
              host: config.host || (String(config.region).toLowerCase() === "eu" ? "smtp.eu.mailgun.org" : "smtp.mailgun.org"),
              port: Number(config.port || 587),
              username: config.username,
              password: config.password,
              fromEmail: config.fromEmail || undefined,
              encryption: (config.encryption || "tls").toLowerCase(),
            });
            await transporter.verify();
            return { data: { success: true, message: "Mailgun SMTP connection verified successfully." } };
          } catch (err: any) {
            return { error: `Mailgun SMTP connection failed: ${err?.message || err}`, status: 400 };
          }
        }
        if (!config.apiKey || !config.domain) return { error: "Mailgun API Key and Domain are required", status: 400 };
        const isEu = String(config.region).toLowerCase() === "eu";
        try {
          const domain: any = await mailgunClient(config.apiKey, config.region).domains.get(config.domain);
          const state = domain?.state ? ` (domain status: ${domain.state})` : "";
          return { data: { success: true, message: `Mailgun API key verified for ${config.domain}${state}.` } };
        } catch (err: any) {
          const status = err?.status ?? err?.statusCode;
          const hint = status === 401
            ? ` Check the API key${isEu ? "" : ", and set Region to EU if your Mailgun domain was created in the EU"}.`
            : status === 404
              ? ` The domain wasn't found in this Mailgun account${isEu ? " (or it's a US-region domain)" : ""}.`
              : "";
          return { error: `Mailgun API check failed: ${err?.message || err}.${hint}`, status: 400 };
        }
      }
      case "gmail": {
        const provider = gmailProviderFromConfig(config);
        if (!provider) return { error: "Gmail address and app password are required", status: 400 };
        try {
          await buildSmtpTransport(provider).verify();
          return { data: { success: true, message: `Signed in to Gmail as ${provider.username}. Staff and notification emails will be sent from this account.` } };
        } catch (err: any) {
          const authFailed = /535|534|auth|credentials/i.test(String(err?.message ?? ""));
          const hint = authFailed
            ? " Use a 16-character app password (not your normal password); the account needs 2-Step Verification turned on."
            : "";
          return { error: `Gmail connection failed: ${err?.message || err}.${hint}`, status: 400 };
        }
      }
      case "smtp": {
        if (!config.host || !config.port) return { error: "Host and Port are required", status: 400 };
        try {
          const transporter = buildSmtpTransport({
            kind: "smtp",
            host: config.host,
            port: Number(config.port),
            username: config.username || undefined,
            password: config.password || undefined,
            encryption: (config.encryption || "").toLowerCase() || undefined,
          });
          await transporter.verify();
          return { data: { success: true, message: "SMTP connection verified successfully. Notification emails will be sent through this server." } };
        } catch (err: any) {
          return { error: `SMTP connection failed: ${err?.message || err}`, status: 400 };
        }
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
