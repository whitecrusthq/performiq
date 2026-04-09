import { EmailSettings } from "../models/EmailSettings.js";

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  region: "us" | "eu";
  fromEmail: string;
  fromName: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

function getApiBase(region: "us" | "eu") {
  return region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
}

function buildAuth(apiKey: string) {
  return "Basic " + Buffer.from(`api:${apiKey}`).toString("base64");
}

function buildFormBody(params: Record<string, string | string[]>) {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.join("&");
}

export async function sendEmail(config: MailgunConfig, opts: SendEmailOptions): Promise<{ id: string; message: string }> {
  const base = getApiBase(config.region);
  const from = `${config.fromName} <${config.fromEmail}>`;
  const toList = Array.isArray(opts.to) ? opts.to : [opts.to];

  const params: Record<string, string | string[]> = {
    from,
    to: toList,
    subject: opts.subject,
  };
  if (opts.text) params["text"] = opts.text;
  if (opts.html) params["html"] = opts.html;
  if (opts.replyTo) params["h:Reply-To"] = opts.replyTo;

  const response = await fetch(`${base}/v3/${config.domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: buildAuth(config.apiKey),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: buildFormBody(params),
  });

  const body = await response.json() as { id?: string; message?: string; error?: string };
  if (!response.ok) {
    throw new Error(body.message ?? body.error ?? `Mailgun error ${response.status}`);
  }
  return { id: body.id ?? "", message: body.message ?? "Queued." };
}

export async function testMailgunConnection(config: MailgunConfig, testEmail: string): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await sendEmail(config, {
      to: testEmail,
      subject: "CommsCRM – Mailgun connection test",
      text: `✅ Your Mailgun integration is working!\n\nDomain: ${config.domain}\nRegion: ${config.region.toUpperCase()}\nSent from: ${config.fromEmail}`,
    });
    return { ok: true, message: `Test email sent. Mailgun ID: ${result.id}` };
  } catch (err: unknown) {
    return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function validateDomain(config: MailgunConfig): Promise<{ ok: boolean; message: string; domain?: Record<string, unknown> }> {
  try {
    const base = getApiBase(config.region);
    const response = await fetch(`${base}/v3/domains/${config.domain}`, {
      headers: { Authorization: buildAuth(config.apiKey) },
    });
    const body = await response.json() as { domain?: Record<string, unknown>; message?: string };
    if (!response.ok) {
      return { ok: false, message: body.message ?? `Domain validation failed (HTTP ${response.status})` };
    }
    return { ok: true, message: "Domain is valid and active.", domain: body.domain };
  } catch (err: unknown) {
    return { ok: false, message: err instanceof Error ? err.message : "Network error" };
  }
}

export async function getEmailSettings(): Promise<EmailSettings | null> {
  return EmailSettings.findOne({ order: [["id", "ASC"]] });
}

export async function buildMailgunConfig(settings: EmailSettings): Promise<MailgunConfig | null> {
  if (!settings.apiKey || !settings.domain || !settings.fromEmail) return null;
  return {
    apiKey: settings.apiKey,
    domain: settings.domain,
    region: settings.region,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName ?? "CommsCRM",
  };
}
