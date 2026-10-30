import { Op } from "sequelize";
import { User, Site, EmployeeGrade, CustomRole, AppSettings, StaffEmailCampaign } from "../models/index.js";
import { resolveEmailProvider, sendEmailVia, sendMailgunBatch, type EmailProvider } from "../lib/email.js";

export interface StaffEmailFilters {
  departments?: string[];
  siteIds?: number[];
  siteCategories?: string[];
  roles?: string[];
  customRoleIds?: number[];
  gradeIds?: number[];
  jobTitles?: string[];
  genders?: string[];
  probationStatuses?: string[];
  shiftTypes?: string[];
}

const MAX_SUBJECT = 200;
const MAX_BODY = 20000;
const SEND_CONCURRENCY = 5;
const MAX_LOGGED_FAILURES = 100;
const MAILGUN_BATCH_SIZE = 1000;

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map(x => String(x ?? "").trim()).filter(Boolean))] : [];
const intList = (v: unknown): number[] =>
  Array.isArray(v) ? [...new Set(v.map(Number).filter(n => Number.isInteger(n) && n > 0))] : [];

/** Drops unknown keys and empty lists so stored filters stay small and readable. */
export function normalizeFilters(raw: any): StaffEmailFilters {
  const f: StaffEmailFilters = {
    departments: strList(raw?.departments),
    siteIds: intList(raw?.siteIds),
    siteCategories: strList(raw?.siteCategories),
    roles: strList(raw?.roles),
    customRoleIds: intList(raw?.customRoleIds),
    gradeIds: intList(raw?.gradeIds),
    jobTitles: strList(raw?.jobTitles),
    genders: strList(raw?.genders),
    probationStatuses: strList(raw?.probationStatuses),
    shiftTypes: strList(raw?.shiftTypes),
  };
  for (const k of Object.keys(f) as (keyof StaffEmailFilters)[]) {
    if (!f[k]?.length) delete f[k];
  }
  return f;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/** Placeholder values for one recipient, keyed by lower-cased placeholder name. */
function placeholderValues(u: any): Record<string, string> {
  return {
    name: u.name ?? "",
    firstname: u.firstName || String(u.name ?? "").split(" ")[0] || "",
    department: u.department ?? "",
    jobtitle: u.jobTitle ?? "",
    staffid: u.staffId ?? "",
  };
}

/** Replaces {{firstName}}, {{name}}, {{department}} etc. with the recipient's values. */
export function personalize(text: string, u: any): string {
  const values = placeholderValues(u);
  return text.replace(PLACEHOLDER, (m, key) => {
    const v = values[String(key).toLowerCase()];
    return v === undefined ? m : v;
  });
}

function renderHtml(bodyHtml: string, company: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
      <div style="color:#333;line-height:1.6;font-size:14px">${bodyHtml.replace(/\r?\n/g, "<br>")}</div>
      <p style="color:#999;font-size:12px;margin-top:32px">Sent by ${escapeHtml(company)} via PerformIQ.</p>
    </div>
  `;
}

/**
 * Builds one Mailgun batch: {{placeholders}} become %recipient.key% variables that
 * Mailgun fills per address. HTML gets pre-escaped copies so names can't inject markup.
 */
export function buildMailgunBatch(recipients: any[], subject: string, body: string, company: string) {
  const known = new Set(Object.keys(placeholderValues({})));
  const toVars = (text: string, suffix: string) => text.replace(PLACEHOLDER, (m, key) => {
    const k = String(key).toLowerCase();
    return known.has(k) ? `%recipient.${k}${suffix}%` : m;
  });
  const recipientVariables: Record<string, Record<string, string>> = {};
  for (const u of recipients) {
    const values = placeholderValues(u);
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      vars[k] = v;
      vars[`${k}_html`] = escapeHtml(v);
    }
    recipientVariables[u.email] = vars;
  }
  return {
    to: recipients.map(u => u.email),
    subject: toVars(subject, ""),
    html: renderHtml(toVars(escapeHtml(body), "_html"), company),
    text: toVars(body, ""),
    recipientVariables,
  };
}

const distinct = (rows: any[], key: string) =>
  [...new Set(rows.map(r => r[key]).filter((v: any) => v !== null && v !== undefined && String(v).trim() !== ""))]
    .map(String)
    .sort((a, b) => a.localeCompare(b));

export default class StaffEmailController {
  /** Filter choices, built from current data so every option matches at least one active staff member. */
  static async options() {
    const [users, sites, grades, customRoles] = await Promise.all([
      User.findAll({
        where: { isActive: true },
        attributes: ["department", "jobTitle", "gender", "probationStatus", "shiftType", "role"],
        raw: true,
      }),
      Site.findAll({ attributes: ["id", "name", "category"], order: [["name", "ASC"]], raw: true }),
      EmployeeGrade.findAll({ attributes: ["id", "name"], order: [["name", "ASC"]], raw: true }),
      CustomRole.findAll({ attributes: ["id", "name"], order: [["name", "ASC"]], raw: true }),
    ]);
    const provider = await resolveEmailProvider().catch(() => null);
    return {
      emailProvider: provider ? provider.label ?? (provider.kind === "mailgun" ? "Mailgun (API)" : "SMTP") : null,
      departments: distinct(users, "department"),
      jobTitles: distinct(users, "jobTitle"),
      genders: distinct(users, "gender"),
      probationStatuses: distinct(users, "probationStatus"),
      shiftTypes: distinct(users, "shiftType"),
      roles: distinct(users, "role"),
      sites: (sites as any[]).map(s => ({ id: s.id, name: s.name, category: s.category })),
      siteCategories: distinct(sites as any[], "category"),
      grades: (grades as any[]).map(g => ({ id: g.id, name: g.name })),
      customRoles: (customRoles as any[]).map(r => ({ id: r.id, name: r.name })),
    };
  }

  /** Active staff with an email address matching every selected filter (no filters = all staff). */
  static async findRecipients(filters: StaffEmailFilters) {
    const where: any = { isActive: true, email: { [Op.ne]: "" } };
    if (filters.departments) where.department = { [Op.in]: filters.departments };
    if (filters.roles) where.role = { [Op.in]: filters.roles };
    if (filters.customRoleIds) where.customRoleId = { [Op.in]: filters.customRoleIds };
    if (filters.gradeIds) where.gradeId = { [Op.in]: filters.gradeIds };
    if (filters.jobTitles) where.jobTitle = { [Op.in]: filters.jobTitles };
    if (filters.genders) where.gender = { [Op.in]: filters.genders };
    if (filters.probationStatuses) where.probationStatus = { [Op.in]: filters.probationStatuses };
    if (filters.shiftTypes) where.shiftType = { [Op.in]: filters.shiftTypes };

    let siteIds = filters.siteIds ?? null;
    if (filters.siteCategories) {
      const catSites = await Site.findAll({ where: { category: { [Op.in]: filters.siteCategories } }, attributes: ["id"], raw: true });
      const catIds = (catSites as any[]).map(s => s.id);
      siteIds = siteIds ? siteIds.filter(id => catIds.includes(id)) : catIds;
    }
    if (siteIds) where.siteId = { [Op.in]: siteIds };

    const [users, sites] = await Promise.all([
      User.findAll({
        where,
        attributes: ["id", "name", "firstName", "email", "department", "jobTitle", "role", "siteId", "staffId"],
        order: [["name", "ASC"]],
        raw: true,
      }),
      Site.findAll({ attributes: ["id", "name"], raw: true }),
    ]);
    const siteNames = new Map((sites as any[]).map(s => [s.id, s.name]));
    return (users as any[]).map(u => ({ ...u, siteName: u.siteId ? siteNames.get(u.siteId) ?? null : null }));
  }

  static async preview(rawFilters: any) {
    const recipients = await StaffEmailController.findRecipients(normalizeFilters(rawFilters));
    return { count: recipients.length, recipients };
  }

  /**
   * Validates the request, records a campaign and sends in the background.
   * `userIds` narrows the filtered audience to the people the sender kept ticked;
   * IDs outside the filtered set are ignored so the filters remain authoritative.
   */
  static async send(actorId: number, data: any) {
    const subject = String(data?.subject ?? "").trim();
    const body = String(data?.body ?? "").trim();
    if (!subject) return { error: "Subject is required", status: 400 };
    if (!body) return { error: "Message is required", status: 400 };
    if (subject.length > MAX_SUBJECT) return { error: `Subject must be ${MAX_SUBJECT} characters or fewer`, status: 400 };
    if (body.length > MAX_BODY) return { error: `Message must be ${MAX_BODY} characters or fewer`, status: 400 };

    const provider = await resolveEmailProvider();
    if (!provider) {
      return { error: "No email provider is configured. Set one up under Settings → Notifications first.", status: 400 };
    }

    const filters = normalizeFilters(data?.filters);
    let recipients = await StaffEmailController.findRecipients(filters);
    if (Array.isArray(data?.userIds)) {
      const keep = new Set(intList(data.userIds));
      recipients = recipients.filter(r => keep.has(r.id));
    }
    if (recipients.length === 0) return { error: "No staff match the selected recipients", status: 400 };

    const campaign = await StaffEmailCampaign.create({
      subject,
      body,
      filters: { ...filters, selectedOnly: Array.isArray(data?.userIds) },
      recipientCount: recipients.length,
      status: "sending",
      sentById: actorId,
    });

    const settings: any = await AppSettings.findByPk(1).catch(() => null);
    const company = settings?.companyName || "HR";

    void StaffEmailController.deliver(campaign.id, provider, recipients, subject, body, company);
    return { data: StaffEmailController.serialize(campaign, null) };
  }

  private static async deliver(campaignId: number, provider: EmailProvider, recipients: any[], subject: string, body: string, company: string) {
    let sent = 0;
    let failedCount = 0;
    const failures: { email: string; error: string }[] = [];
    const fail = (email: string, err: any) => {
      failedCount++;
      if (failures.length < MAX_LOGGED_FAILURES) {
        failures.push({ email, error: String(err?.message ?? err).slice(0, 200) });
      }
    };

    try {
      if (provider.kind === "mailgun") {
        // Mailgun API: up to 1,000 personalised copies per request.
        for (let i = 0; i < recipients.length; i += MAILGUN_BATCH_SIZE) {
          const batch = recipients.slice(i, i + MAILGUN_BATCH_SIZE);
          try {
            await sendMailgunBatch(provider, buildMailgunBatch(batch, subject, body, company));
            sent += batch.length;
          } catch (err: any) {
            console.error(`[staff email ${campaignId}] Mailgun batch of ${batch.length} failed:`, err?.message ?? err);
            batch.forEach(u => fail(u.email, err));
          }
        }
      } else {
        // SMTP (including Gmail and Mailgun SMTP): one message per person, a few at a time.
        const queue = [...recipients];
        const worker = async () => {
          while (queue.length) {
            const u = queue.shift()!;
            const personalBody = personalize(body, u);
            try {
              await sendEmailVia(provider, {
                to: u.email,
                subject: personalize(subject, u),
                html: renderHtml(escapeHtml(personalBody), company),
                text: personalBody,
              });
              sent++;
            } catch (err: any) {
              console.error(`[staff email ${campaignId}] Failed to send to ${u.email}:`, err?.message ?? err);
              fail(u.email, err);
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, recipients.length) }, worker));
      }
    } finally {
      const status = failedCount === 0 ? "completed" : sent === 0 ? "failed" : "completed_with_errors";
      await StaffEmailCampaign.update(
        { sentCount: sent, failedCount, failures, status, completedAt: new Date() },
        { where: { id: campaignId } },
      ).catch(err => console.error(`[staff email ${campaignId}] Failed to record result:`, err));
    }
  }

  static async history() {
    const rows = await StaffEmailCampaign.findAll({ order: [["createdAt", "DESC"]], limit: 50 });
    const senderIds = [...new Set(rows.map(r => r.sentById).filter(Boolean))] as number[];
    const senders = senderIds.length
      ? await User.findAll({ where: { id: { [Op.in]: senderIds } }, attributes: ["id", "name"], raw: true })
      : [];
    const names = new Map((senders as any[]).map(s => [s.id, s.name]));
    return rows.map(r => StaffEmailController.serialize(r, r.sentById ? names.get(r.sentById) ?? null : null));
  }

  private static serialize(r: StaffEmailCampaign, sentByName: string | null) {
    return {
      id: r.id,
      subject: r.subject,
      body: r.body,
      filters: r.filters,
      recipientCount: r.recipientCount,
      sentCount: r.sentCount,
      failedCount: r.failedCount,
      failures: r.failures,
      status: r.status,
      sentByName,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    };
  }
}
