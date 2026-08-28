import Mailgun from "mailgun.js";
import FormData from "form-data";
import nodemailer from "nodemailer";
import { NotificationSettings } from "../models/index.js";

/**
 * Provider-agnostic email sending. Routes through whichever email provider the
 * admin has enabled in Notification Settings (Mailgun or generic SMTP). Falls
 * back to Mailgun env vars (MAILGUN_API_KEY / MAILGUN_DOMAIN) when no platform
 * row is enabled, preserving the original behavior.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface MailgunProvider {
  kind: "mailgun";
  apiKey: string;
  domain: string;
  fromEmail?: string;
}

interface SmtpProvider {
  kind: "smtp";
  host: string;
  port: number;
  username?: string;
  password?: string;
  fromEmail?: string;
  encryption?: string; // "ssl" | "tls"/"starttls" | "none"
}

export type EmailProvider = MailgunProvider | SmtpProvider;

/**
 * Resolves the active email provider.
 * Priority: enabled SMTP settings row → enabled Mailgun settings row →
 * Mailgun env vars → null (email disabled).
 */
export async function resolveEmailProvider(): Promise<EmailProvider | null> {
  let rows: NotificationSettings[] = [];
  try {
    rows = await NotificationSettings.findAll({ where: { platform: ["smtp", "mailgun"], enabled: true } as any });
  } catch (err) {
    console.error("[email] Failed to read notification settings, falling back to env config:", err);
  }

  const smtpRow = rows.find(r => r.platform === "smtp");
  if (smtpRow) {
    const c = (smtpRow.config ?? {}) as Record<string, string>;
    if (c.host && c.port) {
      return {
        kind: "smtp",
        host: c.host,
        port: Number(c.port),
        username: c.username || undefined,
        password: c.password || undefined,
        fromEmail: c.fromEmail || undefined,
        encryption: (c.encryption || "").toLowerCase() || undefined,
      };
    }
    console.log("[email] SMTP platform enabled but host/port missing; ignoring.");
  }

  const mgRow = rows.find(r => r.platform === "mailgun");
  if (mgRow) {
    const c = (mgRow.config ?? {}) as Record<string, string>;
    if (c.authMode === "smtp" && c.username && c.password) {
      return {
        kind: "smtp",
        host: c.host || "smtp.mailgun.org",
        port: Number(c.port || 587),
        username: c.username,
        password: c.password,
        fromEmail: c.fromEmail || undefined,
        encryption: (c.encryption || "tls").toLowerCase(),
      };
    }
    if (c.authMode !== "smtp" && c.apiKey && c.domain) {
      return { kind: "mailgun", apiKey: c.apiKey, domain: c.domain, fromEmail: c.fromEmail || undefined };
    }
    console.log("[email] Mailgun platform enabled but the selected credentials are incomplete; ignoring.");
  }

  // Env fallback (original behavior)
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (key && domain) {
    return { kind: "mailgun", apiKey: key, domain, fromEmail: process.env.MAILGUN_FROM || undefined };
  }
  return null;
}

function defaultFrom(provider: EmailProvider): string {
  if (provider.fromEmail) return provider.fromEmail;
  if (provider.kind === "mailgun") return `noreply@${provider.domain}`;
  return provider.username && provider.username.includes("@")
    ? provider.username
    : `noreply@${provider.host}`;
}

async function sendViaMailgun(provider: MailgunProvider, msg: EmailMessage): Promise<void> {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({ username: "api", key: provider.apiKey });
  await mg.messages.create(provider.domain, {
    from: defaultFrom(provider),
    to: [msg.to],
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
}

export function buildSmtpTransport(provider: SmtpProvider) {
  const enc = provider.encryption ?? (provider.port === 465 ? "ssl" : "tls");
  return nodemailer.createTransport({
    host: provider.host,
    port: provider.port,
    secure: enc === "ssl",                    // implicit TLS (usually port 465)
    requireTLS: enc === "tls" || enc === "starttls",
    ignoreTLS: enc === "none",
    auth: provider.username && provider.password
      ? { user: provider.username, pass: provider.password }
      : undefined,
  });
}

async function sendViaSmtp(provider: SmtpProvider, msg: EmailMessage): Promise<void> {
  const transporter = buildSmtpTransport(provider);
  await transporter.sendMail({
    from: defaultFrom(provider),
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
}

/**
 * Sends an email through the configured provider.
 * Returns true when a send was attempted successfully, false when no provider
 * is configured (skipped gracefully with a log). Provider errors propagate.
 */
export async function sendEmail(msg: EmailMessage, context = "email"): Promise<boolean> {
  const provider = await resolveEmailProvider();
  if (!provider) {
    console.log(`[${context}] No email provider configured, skipping email →`, msg.to);
    return false;
  }
  if (provider.kind === "smtp") {
    await sendViaSmtp(provider, msg);
  } else {
    await sendViaMailgun(provider, msg);
  }
  return true;
}
