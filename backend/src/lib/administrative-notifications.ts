import { Op } from "sequelize";
import { NotificationAdminRecipient, User } from "../models/index.js";
import { sendEmail } from "./email.js";
import { logger } from "./logger.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export async function sendAdministrativeNotification(options: {
  subject: string;
  text: string;
  superAdminsOnly?: boolean;
}): Promise<number> {
  try {
    const configured = await NotificationAdminRecipient.findAll({ attributes: ["userId"] });
    const ids = configured.map(row => row.userId);
    if (ids.length === 0) return 0;
    const users = await User.findAll({
      where: {
        id: { [Op.in]: ids },
        role: options.superAdminsOnly ? "super_admin" : { [Op.in]: ["admin", "super_admin"] },
        isActive: true,
      },
      attributes: ["email"],
    });
    const emails = [...new Set(users.map(user => user.email.toLowerCase().trim()).filter(Boolean))];
    const results = await Promise.all(emails.map(to => sendEmail({
      to,
      subject: options.subject,
      text: options.text,
      html: `<p>${escapeHtml(options.text)}</p>`,
    }, "administrative notification").catch(error => {
      logger.error({ error, recipientUserConfigured: true }, "Administrative notification failed");
      return false;
    })));
    return results.filter(Boolean).length;
  } catch (error) {
    logger.error({ error }, "Could not load administrative notification recipients");
    return 0;
  }
}