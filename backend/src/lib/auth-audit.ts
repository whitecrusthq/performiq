import { Request } from "express";
import AuthAuditLog, { AuthAuditEvent } from "../models/AuthAuditLog.js";
import { getGeoFromIp } from "./ip-geo.js";
import { logger } from "./logger.js";

interface RecordOpts {
  userId?: number | null;
  email: string;
  event: AuthAuditEvent;
  failureReason?: string | null;
}

function getClientIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    return fwd[0].split(",")[0].trim();
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || null;
}

/**
 * Record an authentication event. Fire-and-forget — never blocks the caller and
 * never throws.
 *
 * Geo lookup is intentionally skipped for `login_failed` events:
 *  - Avoids leaking failed-attempt IPs to the third-party geolocation provider.
 *  - Prevents outbound API fan-out during credential-stuffing spikes (each
 *    failed attempt would otherwise trigger a network call).
 * The row is still written with the IP address; admins can resolve geo
 * client-side if needed.
 */
export function recordAuthEvent(req: Request, opts: RecordOpts): void {
  const ipAddress = getClientIp(req);
  const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;
  const lookupGeo = opts.event !== "login_failed";

  void (async () => {
    let geo = null;
    if (lookupGeo) {
      try {
        geo = await getGeoFromIp(ipAddress);
      } catch (err) {
        logger.warn({ err }, "auth-audit geo lookup threw");
      }
    }
    try {
      await AuthAuditLog.create({
        userId: opts.userId ?? null,
        email: opts.email,
        event: opts.event,
        failureReason: opts.failureReason ?? null,
        ipAddress,
        userAgent,
        country: geo?.country ?? null,
        region: geo?.region ?? null,
        city: geo?.city ?? null,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
      });
    } catch (err) {
      logger.error({ err, event: opts.event, email: opts.email }, "Failed to record auth audit event");
    }
  })();
}
