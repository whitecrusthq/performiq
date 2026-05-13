import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set. Server cannot start without it.");
}

export interface AuthRequest extends Request {
  user?: { id: number; role: string; email: string; customRoleName?: string | null };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    // Reject 2FA pending tokens (have a `purpose` claim and no `role`) so they cannot
    // be used as full session tokens to call protected endpoints like /auth/2fa/*.
    if (payload?.purpose || typeof payload?.role !== "string") {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    // Single-active-session check: every successful login bumps users.token_version,
    // so any tokens issued before that login (i.e. an older browser session) are
    // rejected here with a distinct error code the frontend uses to show the
    // "Signed in elsewhere" notice on the login page.
    try {
      const u = await User.findByPk(payload.id, { attributes: ["id", "tokenVersion", "isActive"] });
      if (!u) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }
      const tokenV = typeof payload.v === "number" ? payload.v : 0;
      if (tokenV !== (u as any).tokenVersion) {
        res.status(401).json({ error: "Session ended", reason: "session_replaced" });
        return;
      }
      // Defense-in-depth: even if tokenVersion still matches (e.g. a manual DB
      // update bypassed setActive's bump), reject deactivated users immediately.
      if ((u as any).isActive === false) {
        res.status(401).json({ error: "Account is deactivated", reason: "session_replaced" });
        return;
      }
    } catch (lookupErr) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    req.user = {
      id: payload.id,
      role: payload.role,
      email: payload.email,
      customRoleName: payload.customRoleName ?? null,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  employee: 1,
};

export function requireRole(...roles: Array<string | string[]>) {
  const flat = roles.flat();
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) { res.status(403).json({ error: "Forbidden" }); return; }
    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const minRequired = Math.min(...flat.map(r => ROLE_HIERARCHY[r] ?? 99));
    if (userLevel >= minRequired) { next(); return; }
    res.status(403).json({ error: "Forbidden" });
  };
}

/**
 * Allows: super_admin/admin always, plus any user whose custom role grants the
 * "view_audit_log" permission via the menuPermissions JSON list. Used to gate
 * access to the login activity audit log.
 */
export async function requireAuditLogAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) { res.status(403).json({ error: "Forbidden" }); return; }
  if (req.user.role === "super_admin" || req.user.role === "admin") { next(); return; }
  try {
    const { User, CustomRole } = await import("../models/index.js");
    const u: any = await User.findByPk(req.user.id);
    if (u?.customRoleId) {
      const cr: any = await CustomRole.findByPk(u.customRoleId);
      if (cr) {
        try {
          const perms = JSON.parse(cr.menuPermissions ?? "[]");
          if (Array.isArray(perms) && perms.includes("audit-log")) { next(); return; }
        } catch {}
      }
    }
  } catch {}
  res.status(403).json({ error: "Forbidden" });
}

/**
 * Allows: super_admin, admin, OR any user whose custom role name is "hr manager" (case-insensitive).
 */
export function requireHRAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) { res.status(403).json({ error: "Forbidden" }); return; }
  const { role, customRoleName } = req.user;
  if (role === "super_admin" || role === "admin") { next(); return; }
  if (customRoleName && customRoleName.toLowerCase() === "hr manager") { next(); return; }
  res.status(403).json({ error: "Forbidden" });
}

export function generateToken(user: { id: number; role: string; email: string; customRoleName?: string | null; tokenVersion: number }) {
  const { tokenVersion, ...rest } = user;
  return jwt.sign({ ...rest, v: tokenVersion }, JWT_SECRET, { expiresIn: "7d" });
}

export function generate2FAPendingToken(payload: { id: number; email: string; purpose: "2fa-verify" | "2fa-setup" }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "10m" });
}

export function verify2FAPendingToken(token: string): { id: number; email: string; purpose: "2fa-verify" | "2fa-setup" } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload?.purpose !== "2fa-verify" && payload?.purpose !== "2fa-setup") return null;
    if (typeof payload.id !== "number" || typeof payload.email !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}
