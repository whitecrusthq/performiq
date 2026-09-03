import { Request } from "express";
import { Op, Transaction } from "sequelize";
import { RecoveryAuditLog, RecoveryRequest, sequelize } from "../models/index.js";
import { logger } from "./logger.js";
import { sendAdministrativeNotification } from "./administrative-notifications.js";

export interface RecoveryRequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export function recoveryContext(req: Request): RecoveryRequestContext {
  const forwarded = req.headers["x-forwarded-for"];
  const ipAddress = typeof forwarded === "string"
    ? forwarded.split(",")[0].trim()
    : Array.isArray(forwarded) ? forwarded[0]?.split(",")[0].trim() || null : req.ip || req.socket?.remoteAddress || null;
  return { ipAddress, userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null };
}

export async function auditRecovery(
  event: string,
  userId: number,
  context: RecoveryRequestContext,
  options: { requestId?: number | null; actorId?: number | null; detail?: string | null; transaction?: Transaction } = {},
) {
  await RecoveryAuditLog.create({
    requestId: options.requestId ?? null,
    userId,
    actorId: options.actorId ?? null,
    event,
    detail: options.detail ?? null,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  }, { transaction: options.transaction });
}

export async function expirePending(request: RecoveryRequest, context: RecoveryRequestContext, transaction?: Transaction) {
  if (request.status === "pending") {
    // Do not write a stale model instance: a concurrent resolver may have changed
    // the row after it was read. The conditional update is the single expiry
    // transition and makes the audit row exactly-once.
    const [updated] = await RecoveryRequest.update(
      { status: "expired", resolvedAt: new Date() },
      { where: { id: request.id, status: "pending", expiresAt: { [Op.lte]: sequelize.literal("NOW()") } }, transaction },
    );
    if (!updated) return false;
    request.setDataValue("status", "expired");
    request.setDataValue("resolvedAt", new Date());
    await auditRecovery("expire", request.userId, context, { requestId: request.id, transaction });
    return true;
  }
  return false;
}

export async function notifyRecoveryAdmins(subject: string, text: string, superAdminsOnly = false): Promise<void> {
  await sendAdministrativeNotification({ subject, text, superAdminsOnly });
}