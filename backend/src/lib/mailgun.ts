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
