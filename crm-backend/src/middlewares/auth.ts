import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { Agent } from "../models/index.js";

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET environment variable is not set. Refusing to start in production.");
    process.exit(1);
  } else {
    console.warn("WARNING: JWT_SECRET is not set. Using a random ephemeral secret — all sessions will be invalidated on restart.");
  }
}
const JWT_SECRET: string = process.env.JWT_SECRET ?? randomBytes(32).toString("hex");

// Throttle: only write lastActiveAt at most once per 60 seconds per agent
const lastActiveWritten = new Map<number, number>();

export interface AuthRequest extends Request {
  agent?: {
    id: number;
    email: string;
    role: string;
    name: string;
  };
}

export function generateToken(agent: { id: number; email: string; role: string; name: string }): string {
  return jwt.sign(agent, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string; name: string };
    req.agent = payload;

    // Fire-and-forget: update lastActiveAt with 60s throttle
    const agentId = payload.id;
    const now = Date.now();
    const lastWrite = lastActiveWritten.get(agentId) ?? 0;
    if (now - lastWrite > 60_000) {
      lastActiveWritten.set(agentId, now);
      Agent.update({ lastActiveAt: new Date() }, { where: { id: agentId } }).catch(() => {});
    }

    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.agent || req.agent.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
