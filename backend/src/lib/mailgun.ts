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

export type RecruitmentNotifyEvent =
  | "new_candidate"
  | "stage_change"
  | "candidate_hired"
  | "job_opened"
  | "job_closed";

export interface RecruitmentNotifyPayload {
  event: RecruitmentNotifyEvent;
  to: string;
  recipientName: string;
  candidateName?: string;
  jobTitle: string;
  department?: string;
  stage?: string;
  previousStage?: string;
  loginEmail?: string;
  startDate?: string;
}

const STAGE_LABEL: Record<string, string> = {
  applied: "Applied", screening: "Screening", interview: "Interview",
  offer: "Offer", hired: "Hired", rejected: "Rejected",
};

export async function sendRecruitmentNotification(payload: RecruitmentNotifyPayload): Promise<void> {
  let { mg, domain } = (() => {
    try { return getClient(); }
    catch { return { mg: null, domain: "" }; }
  })();
  if (!mg) {
    console.log("[recruitment notify] Mailgun not configured, skipping email:", payload.event, "→", payload.to);
    return;
  }

  const from = process.env.MAILGUN_FROM ?? `noreply@${domain}`;

  const subjects: Record<RecruitmentNotifyEvent, string> = {
    new_candidate:   `New Candidate for ${payload.jobTitle} — ${payload.candidateName}`,
    stage_change:    `Candidate Update: ${payload.candidateName} — ${STAGE_LABEL[payload.stage || ""] || payload.stage}`,
    candidate_hired: `Welcome to the Team — ${payload.jobTitle}`,
    job_opened:      `New Job Opening: ${payload.jobTitle}`,
    job_closed:      `Job Closed: ${payload.jobTitle}`,
  };

  const intros: Record<RecruitmentNotifyEvent, string> = {
    new_candidate:   `Hi <strong>${payload.recipientName}</strong>, a new candidate <strong>${payload.candidateName}</strong> has been added to the <strong>${payload.jobTitle}</strong> position.`,
    stage_change:    `Hi <strong>${payload.recipientName}</strong>, candidate <strong>${payload.candidateName}</strong> for <strong>${payload.jobTitle}</strong> has moved from <strong>${STAGE_LABEL[payload.previousStage || ""] || payload.previousStage}</strong> to <strong>${STAGE_LABEL[payload.stage || ""] || payload.stage}</strong>.`,
    candidate_hired: `Congratulations <strong>${payload.recipientName}</strong>! We are delighted to welcome you to the team as <strong>${payload.jobTitle}</strong>${payload.department ? ` in the ${payload.department} department` : ""}.`,
    job_opened:      `A new position for <strong>${payload.jobTitle}</strong>${payload.department ? ` in ${payload.department}` : ""} has been opened.`,
    job_closed:      `The position <strong>${payload.jobTitle}</strong> has been closed.`,
  };

  let detailRows = "";
  if (payload.event === "candidate_hired") {
    detailRows = `
      <tr><td style="padding:4px 0;color:#888;width:40%">Position</td><td style="padding:4px 0;font-weight:600">${payload.jobTitle}</td></tr>
      ${payload.department ? `<tr><td style="padding:4px 0;color:#888">Department</td><td style="padding:4px 0;font-weight:600">${payload.department}</td></tr>` : ""}
      ${payload.startDate ? `<tr><td style="padding:4px 0;color:#888">Start Date</td><td style="padding:4px 0;font-weight:600">${payload.startDate}</td></tr>` : ""}
      ${payload.loginEmail ? `<tr><td style="padding:4px 0;color:#888">Login Email</td><td style="padding:4px 0;font-weight:600">${payload.loginEmail}</td></tr>` : ""}
    `;
  } else if (payload.event === "stage_change") {
    detailRows = `
      <tr><td style="padding:4px 0;color:#888;width:40%">Candidate</td><td style="padding:4px 0;font-weight:600">${payload.candidateName}</td></tr>
      <tr><td style="padding:4px 0;color:#888">Position</td><td style="padding:4px 0;font-weight:600">${payload.jobTitle}</td></tr>
      <tr><td style="padding:4px 0;color:#888">New Stage</td><td style="padding:4px 0;font-weight:600">${STAGE_LABEL[payload.stage || ""] || payload.stage}</td></tr>
    `;
  } else {
    detailRows = `
      <tr><td style="padding:4px 0;color:#888;width:40%">Position</td><td style="padding:4px 0;font-weight:600">${payload.jobTitle}</td></tr>
      ${payload.department ? `<tr><td style="padding:4px 0;color:#888">Department</td><td style="padding:4px 0;font-weight:600">${payload.department}</td></tr>` : ""}
      ${payload.candidateName ? `<tr><td style="padding:4px 0;color:#888">Candidate</td><td style="padding:4px 0;font-weight:600">${payload.candidateName}</td></tr>` : ""}
    `;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="margin-bottom:4px;color:#1a1a1a">${subjects[payload.event]}</h2>
      <p style="color:#555;margin-bottom:24px">${intros[payload.event]}</p>
      <div style="background:#f4f4f5;border-radius:12px;padding:20px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${detailRows}
        </table>
      </div>
      ${payload.event === "candidate_hired" ? `<p style="color:#555;font-size:14px">Your manager will share further details about your first day. Please log in using the email above and your temporary password to get started.</p>` : ""}
      <p style="color:#999;font-size:12px">This is an automated notification from PerformIQ.</p>
    </div>
  `;

  const subject = subjects[payload.event];
  const textParts = [subject];
  if (payload.candidateName) textParts.push(`Candidate: ${payload.candidateName}`);
  textParts.push(`Position: ${payload.jobTitle}`);
  if (payload.department) textParts.push(`Department: ${payload.department}`);
  if (payload.stage) textParts.push(`Stage: ${STAGE_LABEL[payload.stage] || payload.stage}`);
  if (payload.startDate) textParts.push(`Start Date: ${payload.startDate}`);

  await mg.messages.create(domain, {
    from,
    to: [payload.to],
    subject,
    html,
    text: textParts.join("\n"),
  });
}

export type CandidateNotifyEvent =
  | "application_received"
  | "moved_to_screening"
  | "interview_scheduled"
  | "offer_extended"
  | "application_rejected"
  | "hired";

export interface CandidateNotifyPayload {
  event: CandidateNotifyEvent;
  to: string;
  candidateName: string;
  jobTitle: string;
  department?: string;
  companyName?: string;
  trackingUrl?: string;
  interviewDate?: string;
  rejectionReason?: string;
  startDate?: string;
}

export async function sendCandidateNotification(payload: CandidateNotifyPayload): Promise<void> {
  let { mg, domain } = (() => {
    try { return getClient(); }
    catch { return { mg: null, domain: "" }; }
  })();
  if (!mg) {
    console.log("[candidate notify] Mailgun not configured, skipping email:", payload.event, "→", payload.to);
    return;
  }

  const from = process.env.MAILGUN_FROM ?? `noreply@${domain}`;
  const company = payload.companyName || "the company";

  const subjects: Record<CandidateNotifyEvent, string> = {
    application_received: `Application Received — ${payload.jobTitle}`,
    moved_to_screening: `Application Update — ${payload.jobTitle}`,
    interview_scheduled: `Interview Invitation — ${payload.jobTitle}`,
    offer_extended: `Job Offer — ${payload.jobTitle}`,
    application_rejected: `Application Update — ${payload.jobTitle}`,
    hired: `Welcome Aboard! — ${payload.jobTitle}`,
  };

  const intros: Record<CandidateNotifyEvent, string> = {
    application_received: `Dear <strong>${payload.candidateName}</strong>,<br><br>Thank you for applying for the <strong>${payload.jobTitle}</strong> position${payload.department ? ` in our ${payload.department} department` : ""}. We have received your application and our team will review it carefully.`,
    moved_to_screening: `Dear <strong>${payload.candidateName}</strong>,<br><br>We are pleased to let you know that your application for <strong>${payload.jobTitle}</strong> has progressed to the screening stage. Our hiring team is currently reviewing your qualifications.`,
    interview_scheduled: `Dear <strong>${payload.candidateName}</strong>,<br><br>We are delighted to invite you for an interview for the <strong>${payload.jobTitle}</strong> position.${payload.interviewDate ? ` Your interview is scheduled for <strong>${payload.interviewDate}</strong>.` : " We will be in touch with the interview details shortly."}`,
    offer_extended: `Dear <strong>${payload.candidateName}</strong>,<br><br>We are thrilled to inform you that we would like to extend an offer for the <strong>${payload.jobTitle}</strong> position. Our team will be in touch with the full details of the offer.`,
    application_rejected: `Dear <strong>${payload.candidateName}</strong>,<br><br>Thank you for your interest in the <strong>${payload.jobTitle}</strong> position and for taking the time to apply. After careful consideration, we have decided to move forward with other candidates at this time.`,
    hired: `Dear <strong>${payload.candidateName}</strong>,<br><br>Congratulations! We are excited to officially welcome you to the team as <strong>${payload.jobTitle}</strong>${payload.department ? ` in our ${payload.department} department` : ""}.${payload.startDate ? ` Your start date is <strong>${payload.startDate}</strong>.` : ""}`,
  };

  const closings: Record<CandidateNotifyEvent, string> = {
    application_received: "We will keep you updated on the progress of your application. You can also track your application status using the link below.",
    moved_to_screening: "We will be in touch as your application progresses. Thank you for your patience.",
    interview_scheduled: "Please reply to this email if you need to reschedule. We look forward to speaking with you.",
    offer_extended: "We hope you are as excited as we are! Please do not hesitate to reach out if you have any questions.",
    application_rejected: `${payload.rejectionReason || "We encourage you to apply for future openings that match your skills and experience."} We wish you all the best in your career.`,
    hired: "Your manager will reach out with onboarding details and everything you need to get started. Welcome aboard!",
  };

  const trackingSection = payload.trackingUrl ? `
    <div style="margin-top:20px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;text-align:center">
      <p style="color:#555;font-size:13px;margin-bottom:8px">Track your application status:</p>
      <a href="${payload.trackingUrl}" style="color:#3b82f6;font-weight:600;font-size:14px;text-decoration:none">View Application Status</a>
    </div>
  ` : "";

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="margin-bottom:4px;color:#1a1a1a">${subjects[payload.event]}</h2>
      <p style="color:#555;margin-bottom:24px;line-height:1.6">${intros[payload.event]}</p>
      <p style="color:#555;line-height:1.6">${closings[payload.event]}</p>
      ${trackingSection}
      <p style="color:#999;font-size:12px;margin-top:24px">This is an automated notification from ${company}.</p>
    </div>
  `;

  await mg.messages.create(domain, {
    from,
    to: [payload.to],
    subject: subjects[payload.event],
    html,
    text: `${subjects[payload.event]}\n\n${intros[payload.event].replace(/<[^>]*>/g, "")}\n\n${closings[payload.event]}`,
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
