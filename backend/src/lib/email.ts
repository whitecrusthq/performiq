import Mailgun from "mailgun.js";
import FormData from "form-data";
import nodemailer from "nodemailer";
import { NotificationSettings } from "../models/index.js";

/**
 * Provider-agnostic email sending. Routes through whichever email provider the
 * admin has enabled in Notification Settings (Mailgun or generic SMTP). Falls
 * back to Mailgun SMTP or API environment credentials when no platform row is
 * enabled, preserving the original API behavior while supporting SMTP secrets.
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
  region?: string; // "us" (default) | "eu"
  label?: string;
}

interface SmtpProvider {
  kind: "smtp";
  host: string;
  port: number;
  username?: string;
  password?: string;
  fromEmail?: string;
  encryption?: string; // "ssl" | "tls"/"starttls" | "none"
  label?: string;
}

export type EmailProvider = MailgunProvider | SmtpProvider;

/**
 * Resolves the active email provider.
 * Priority: enabled SMTP settings row → enabled Gmail settings row → enabled
 * Mailgun settings row → Mailgun SMTP env vars → Mailgun API env vars → null
 * (email disabled).
 */
export async function resolveEmailProvider(): Promise<EmailProvider | null> {
  let rows: NotificationSettings[] = [];
  try {
    rows = await NotificationSettings.findAll({ where: { platform: ["smtp", "gmail", "mailgun"], enabled: true } as any });
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
        label: "SMTP",
      };
    }
    console.log("[email] SMTP platform enabled but host/port missing; ignoring.");
  }

  const gmailRow = rows.find(r => r.platform === "gmail");
  if (gmailRow) {
    const gmail = gmailProviderFromConfig((gmailRow.config ?? {}) as Record<string, string>);
    if (gmail) return gmail;
    console.log("[email] Gmail platform enabled but address/app password missing; ignoring.");
  }

  const mgRow = rows.find(r => r.platform === "mailgun");
  if (mgRow) {
    const c = (mgRow.config ?? {}) as Record<string, string>;
    if (c.authMode === "smtp" && c.username && c.password) {
      return {
        kind: "smtp",
        host: c.host || mailgunSmtpHost(c.region),
        port: Number(c.port || 587),
        username: c.username,
        password: c.password,
        fromEmail: c.fromEmail || undefined,
        encryption: (c.encryption || "tls").toLowerCase(),
        label: "Mailgun (SMTP)",
      };
    }
    if (c.authMode !== "smtp" && c.apiKey && c.domain) {
      return { kind: "mailgun", apiKey: c.apiKey, domain: c.domain, fromEmail: c.fromEmail || undefined, region: c.region || undefined, label: "Mailgun (API)" };
    }
    console.log("[email] Mailgun platform enabled but the selected credentials are incomplete; ignoring.");
  }

  const smtpUsername = process.env.MAILGUN_SMTP_USERNAME;
  const smtpPassword = process.env.MAILGUN_SMTP_PASSWORD;
  if (smtpUsername && smtpPassword) {
    return {
      kind: "smtp",
      host: process.env.MAILGUN_SMTP_HOST || mailgunSmtpHost(process.env.MAILGUN_REGION),
      port: Number(process.env.MAILGUN_SMTP_PORT || 587),
      username: smtpUsername,
      password: smtpPassword,
      fromEmail: process.env.MAILGUN_FROM || smtpUsername,
      encryption: (process.env.MAILGUN_SMTP_ENCRYPTION || "tls").toLowerCase(),
      label: "Mailgun (SMTP)",
    };
  }

  // API environment fallback (original behavior)
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (key && domain) {
    return { kind: "mailgun", apiKey: key, domain, fromEmail: process.env.MAILGUN_FROM || undefined, region: process.env.MAILGUN_REGION || undefined, label: "Mailgun (API)" };
  }
  return null;
}

const isEu = (region?: string) => String(region ?? "").trim().toLowerCase() === "eu";

function mailgunSmtpHost(region?: string): string {
  return isEu(region) ? "smtp.eu.mailgun.org" : "smtp.mailgun.org";
}

/** Mailgun API client for the account's region; EU domains are only reachable on the EU endpoint. */
export function mailgunClient(apiKey: string, region?: string) {
  const mailgun = new Mailgun(FormData);
  return mailgun.client({
    username: "api",
    key: apiKey,
    ...(isEu(region) ? { url: "https://api.eu.mailgun.net" } : {}),
  });
}

/**
 * Gmail / Google Workspace over SMTP with an app password. Google rewrites the
 * From address to the authenticated account, so only a display name is configurable.
 */
export function gmailProviderFromConfig(c: Record<string, string>): SmtpProvider | null {
  const address = String(c.username ?? "").trim();
  const appPassword = String(c.password ?? "").replace(/\s+/g, "");
  if (!address || !appPassword) return null;
  const name = String(c.fromName ?? "").trim().replace(/["<>]/g, "");
  return {
    kind: "smtp",
    host: "smtp.gmail.com",
    port: 465,
    username: address,
    password: appPassword,
    fromEmail: name ? `"${name}" <${address}>` : address,
    encryption: "ssl",
    label: "Gmail",
  };
}

function defaultFrom(provider: EmailProvider): string {
  if (provider.fromEmail) return provider.fromEmail;
  if (provider.kind === "mailgun") return `noreply@${provider.domain}`;
  return provider.username && provider.username.includes("@")
    ? provider.username
    : `noreply@${provider.host}`;
}

async function sendViaMailgun(provider: MailgunProvider, msg: EmailMessage): Promise<void> {
  const mg = mailgunClient(provider.apiKey, provider.region);
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
  await sendEmailVia(provider, msg);
  return true;
}

/** Sends through an already-resolved provider, so bulk sends resolve it once. */
export async function sendEmailVia(provider: EmailProvider, msg: EmailMessage): Promise<void> {
  if (provider.kind === "smtp") {
    await sendViaSmtp(provider, msg);
  } else {
    await sendViaMailgun(provider, msg);
  }
}

export interface MailgunBatch {
  to: string[];
  subject: string;
  html: string;
  text: string;
  /** Per-address values referenced in the content as %recipient.key%. */
  recipientVariables: Record<string, Record<string, string>>;
}

/**
 * One Mailgun API call for up to 1,000 recipients. Each address receives its
 * own copy (recipient variables stop Mailgun showing the whole list in To).
 */
export async function sendMailgunBatch(provider: EmailProvider, batch: MailgunBatch): Promise<void> {
  if (provider.kind !== "mailgun") throw new Error("Batch sending requires the Mailgun API provider");
  if (batch.to.length > 1000) throw new Error("Mailgun batches are limited to 1,000 recipients");
  const mg = mailgunClient(provider.apiKey, provider.region);
  await mg.messages.create(provider.domain, {
    from: defaultFrom(provider),
    to: batch.to,
    subject: batch.subject,
    html: batch.html,
    text: batch.text,
    "recipient-variables": JSON.stringify(batch.recipientVariables),
  });
}
