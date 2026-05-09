import { Response } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../../middlewares/auth.js";
import { recordAuthEvent } from "../../lib/auth-audit.js";

const JWT_SECRET = process.env.JWT_SECRET!;

export class LogoutAction {
  static async handle(req: AuthRequest, res: Response) {
    // Best-effort token decode — don't reject if missing/expired so the client
    // can always perform local cleanup. Only log if we can identify the user.
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
        if (payload?.id && payload?.email && typeof payload.role === "string") {
          recordAuthEvent(req, {
            userId: Number(payload.id),
            email: String(payload.email),
            event: "logout",
          });
        }
      } catch {
        // expired or invalid token — silently skip audit; still return ok
      }
    }
    res.json({ message: "Logged out" });
  }
}
