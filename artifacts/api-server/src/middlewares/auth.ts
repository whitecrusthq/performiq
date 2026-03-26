import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "performiq-secret-key-change-in-production";

export interface AuthRequest extends Request {
  user?: { id: number; role: string; email: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; role: string; email: string };
    req.user = payload;
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

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) { res.status(403).json({ error: "Forbidden" }); return; }
    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const minRequired = Math.min(...roles.map(r => ROLE_HIERARCHY[r] ?? 99));
    if (userLevel >= minRequired) { next(); return; }
    res.status(403).json({ error: "Forbidden" });
  };
}

export function generateToken(user: { id: number; role: string; email: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}
