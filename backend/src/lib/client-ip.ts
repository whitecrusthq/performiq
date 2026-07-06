import { Request } from "express";

/** Best-effort client IP: first hop of X-Forwarded-For, else socket address. */
export function getClientIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return first || req.ip || req.socket?.remoteAddress || null;
}
