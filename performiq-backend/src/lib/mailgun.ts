import Mailgun from "mailgun.js";
import FormData from "form-data";

function getClient() {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!key || !domain) {
    throw new Error("Mailgun is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
  }
  const mailgun = new Mailgun(FormData);
  return { mg: mailgun.client({ username: "api", key }), domain };
}

export type LeaveNotifyEvent =
  | "submitted"        // notify first approver: a request awaits their review
  | "awaiting_next"    // notify next approver: previous approved, your turn
  | "approved"         // notify employee: fully approved
  | "rejected"         // notify employee: rejected
  | "cancelled";       // notify approvers: request was cancelled

export interface LeaveNotifyPayload {
  event: LeaveNotifyEvent;
  to: string;          // recipient email
  recipientName: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reviewerNote?: string;
}

const LEAVE_LABEL: Record<string, string> = {
  annual: "Annual Leave", sick: "Sick Leave", personal: "Personal Leave",
  maternity: "Maternity Leave", paternity: "Paternity Leave", unpaid: "Unpaid Leave", other: "Other",
};

export async function sendLeaveNotification(payload: LeaveNotifyPayload): Promise<void> {
  let { mg, domain } = (() => {
    try { return getClient(); }
    catch { return { mg: null, domain: "" }; }
  })();
  if (!mg) {
    console.log("[leave notify] Mailgun not configured, skipping email:", payload.event, "→", payload.to);
    return;
  }

  const from = process.env.MAILGUN_FROM ?? `noreply@${domain}`;
  const leaveLabel = LEAVE_LABEL[payload.leaveType] ?? payload.leaveType;
  const dateRange = `${payload.startDate} – ${payload.endDate} (${payload.days} day${payload.days !== 1 ? "s" : ""})`;

  const subjects: Record<LeaveNotifyEvent, string> = {
    submitted:     `Leave Request Awaiting Your Review — ${payload.employeeName}`,
    awaiting_next: `Leave Request Awaiting Your Review — ${payload.employeeName}`,
    approved:      `Your Leave Request Has Been Approved`,
    rejected:      `Your Leave Request Has Been Declined`,
    cancelled:     `Leave Request Cancelled — ${payload.employeeName}`,
  };

  const intros: Record<LeaveNotifyEvent, string> = {
    submitted:     `A leave request has been submitted by <strong>${payload.employeeName}</strong> and is awaiting your approval.`,
    awaiting_next: `The previous approver has approved <strong>${payload.employeeName}</strong>'s leave request. It now requires your review.`,
    approved:      `Great news, <strong>${payload.recipientName}</strong>! Your leave request has been fully approved.`,
    rejected:      `Hi <strong>${payload.recipientName}</strong>, unfortunately your leave request has been declined.`,
    cancelled:     `<strong>${payload.employeeName}</strong>'s leave request has been cancelled by the applicant.`,
  };

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="margin-bottom:4px;color:#1a1a1a">${subjects[payload.event]}</h2>
      <p style="color:#555;margin-bottom:24px">${intros[payload.event]}</p>
      <div style="background:#f4f4f5;border-radius:12px;padding:20px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 0;color:#888;width:40%">Leave Type</td><td style="padding:4px 0;font-weight:600">${leaveLabel}</td></tr>
          <tr><td style="padding:4px 0;color:#888">Dates</td><td style="padding:4px 0;font-weight:600">${dateRange}</td></tr>
          ${payload.reviewerNote ? `<tr><td style="padding:4px 0;color:#888">Note</td><td style="padding:4px 0;font-style:italic">"${payload.reviewerNote}"</td></tr>` : ""}
        </table>
      </div>
      <p style="color:#999;font-size:12px">This is an automated notification from PerformIQ.</p>
    </div>
  `;

  await mg.messages.create(domain, {
    from,
    to: [payload.to],
    subject: subjects[payload.event],
    html,
    text: `${subjects[payload.event]}\n\nLeave Type: ${leaveLabel}\nDates: ${dateRange}${payload.reviewerNote ? `\nNote: ${payload.reviewerNote}` : ""}`,
  });
}

export async function sendOtpEmail(to: string, otp: string, name: string): Promise<void> {
  const { mg, domain } = getClient();
  const from = process.env.MAILGUN_FROM ?? `noreply@${domain}`;

  await mg.messages.create(domain, {
    from,
    to: [to],
    subject: "Your PerformIQ Login Code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a1a1a;margin-bottom:8px">Your login code</h2>
        <p style="color:#555;margin-bottom:24px">Hi ${name}, use the code below to complete your sign-in. It expires in 10 minutes.</p>
        <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a1a">${otp}</span>
        </div>
        <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `,
    text: `Your PerformIQ login code is: ${otp}\n\nIt expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
  });
}
