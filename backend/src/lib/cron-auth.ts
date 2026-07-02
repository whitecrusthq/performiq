import { timingSafeEqual } from "crypto";
import { Request } from "express";

/**
 * Extract the caller-supplied cron secret from either an
 * `Authorization: Bearer <token>` header or an `x-cron-secret` header.
 */
function extractProvidedSecret(req: Request): string | null {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  const header = req.headers["x-cron-secret"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  return null;
}

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Validate a request against the configured `SWEEP_SECRET`.
 * - If no secret is configured the endpoint is treated as disabled (503) so it
 *   can never be triggered unauthenticated.
 * - Otherwise the provided token must match via a constant-time comparison.
 */
export function verifyCronSecret(req: Request): CronAuthResult {
  const expected = process.env["SWEEP_SECRET"];
  if (!expected || !expected.trim()) {
    return {
      ok: false,
      status: 503,
      error: "Sweep endpoint is disabled: SWEEP_SECRET is not configured.",
    };
  }
  const provided = extractProvidedSecret(req);
  if (!provided) {
    return { ok: false, status: 401, error: "Missing cron secret." };
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Invalid cron secret." };
  }
  return { ok: true };
}
