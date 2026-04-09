import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { Agent } from "../models/index.js";
import { requireAuth, generateToken, JWT_SECRET, AuthRequest } from "../middlewares/auth.js";

const router = Router();

function partialToken(agentId: number): string {
  return jwt.sign({ agentId, scope: "2fa-pending" }, JWT_SECRET, { expiresIn: "5m" });
}

function verifyPartialToken(token: string): { agentId: number } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { agentId: number; scope: string };
    if (payload.scope !== "2fa-pending") return null;
    return { agentId: payload.agentId };
  } catch {
    return null;
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const agent = await Agent.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!agent) { res.status(401).json({ error: "Invalid credentials" }); return; }
    if (!agent.isActive) { res.status(403).json({ error: "Account is deactivated" }); return; }

    const valid = await bcrypt.compare(password, agent.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }

    if (agent.totpEnabled && agent.totpSecret) {
      res.json({ requires2FA: true, partialToken: partialToken(agent.id) });
      return;
    }

    const token = generateToken({ id: agent.id, email: agent.email, role: agent.role, name: agent.name });
    res.json({
      token,
      agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role, avatar: agent.avatar, allowedMenus: agent.allowedMenus },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Complete 2FA login ────────────────────────────────────────────────────────
router.post("/auth/2fa/complete", async (req, res) => {
  try {
    const { partialToken: pToken, code } = req.body;
    if (!pToken || !code) { res.status(400).json({ error: "partialToken and code required" }); return; }

    const payload = verifyPartialToken(pToken);
    if (!payload) { res.status(401).json({ error: "Invalid or expired session. Please log in again." }); return; }

    const agent = await Agent.findByPk(payload.agentId);
    if (!agent || !agent.totpEnabled || !agent.totpSecret) {
      res.status(401).json({ error: "2FA not configured for this account" });
      return;
    }

    const isValid = speakeasy.totp.verify({ secret: agent.totpSecret, encoding: "base32", token: code.replace(/\s/g, ""), window: 1 });
    if (!isValid) { res.status(401).json({ error: "Invalid authenticator code" }); return; }

    const token = generateToken({ id: agent.id, email: agent.email, role: agent.role, name: agent.name });
    res.json({
      token,
      agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role, avatar: agent.avatar, allowedMenus: agent.allowedMenus },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Me ────────────────────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agent = await Agent.findByPk(req.agent!.id, {
      attributes: ["id", "name", "email", "role", "avatar", "isActive", "totpEnabled", "activeConversations", "resolvedToday", "rating"],
    });
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
    res.json(agent);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── 2FA Setup: generate secret + QR code ─────────────────────────────────────
router.get("/auth/2fa/setup", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agent = await Agent.findByPk(req.agent!.id);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

    const secretObj = speakeasy.generateSecret({ length: 20, name: `CommsCRM (${agent.email})`, issuer: "CommsCRM" });
    const otpauth = speakeasy.otpauthURL({ secret: secretObj.base32, label: agent.email, issuer: "CommsCRM", encoding: "base32" });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    agent.totpSecret = secretObj.base32;
    agent.totpEnabled = false;
    await agent.save();

    res.json({ secret: secretObj.base32, qrCode: qrCodeDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── 2FA Enable: verify code and activate ─────────────────────────────────────
router.post("/auth/2fa/enable", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: "code required" }); return; }

    const agent = await Agent.findByPk(req.agent!.id);
    if (!agent || !agent.totpSecret) { res.status(400).json({ error: "Run 2FA setup first" }); return; }

    const isValid = speakeasy.totp.verify({ secret: agent.totpSecret, encoding: "base32", token: code.replace(/\s/g, ""), window: 1 });
    if (!isValid) { res.status(400).json({ error: "Invalid authenticator code. Please try again." }); return; }

    agent.totpEnabled = true;
    await agent.save();
    res.json({ ok: true, message: "Two-factor authentication enabled." });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── 2FA Disable: verify code and deactivate ───────────────────────────────────
router.post("/auth/2fa/disable", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: "code required" }); return; }

    const agent = await Agent.findByPk(req.agent!.id);
    if (!agent || !agent.totpEnabled || !agent.totpSecret) {
      res.status(400).json({ error: "2FA is not enabled on this account" });
      return;
    }

    const isValid = speakeasy.totp.verify({ secret: agent.totpSecret, encoding: "base32", token: code.replace(/\s/g, ""), window: 1 });
    if (!isValid) { res.status(400).json({ error: "Invalid authenticator code." }); return; }

    agent.totpEnabled = false;
    agent.totpSecret = null;
    await agent.save();
    res.json({ ok: true, message: "Two-factor authentication disabled." });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── 2FA Status ────────────────────────────────────────────────────────────────
router.get("/auth/2fa/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agent = await Agent.findByPk(req.agent!.id, { attributes: ["id", "totpEnabled"] });
    if (!agent) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ totpEnabled: agent.totpEnabled });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
