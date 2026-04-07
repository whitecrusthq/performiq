import { Router } from "express";
import bcrypt from "bcryptjs";
import { Agent } from "../models/index.js";
import { requireAuth, requireAdmin, requireSuperAdmin, AuthRequest } from "../middlewares/auth.js";
import type { AgentAttributes } from "../models/Agent.js";

const router = Router();

function isSuperAdmin(role: string) { return role === "super_admin"; }
function isAdminOrAbove(role: string) { return role === "admin" || role === "super_admin"; }

router.get("/agents", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const agents = await Agent.findAll({
      attributes: ["id", "name", "email", "role", "avatar", "isActive", "allowedMenus", "siteIds", "activeConversations", "resolvedToday", "rating", "createdAt"],
      order: [["createdAt", "ASC"]],
    });
    res.json(agents);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agents", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, email, password, role, allowedMenus, siteIds } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }

    const requestingRole = req.agent!.role;

    if (role === "super_admin") {
      res.status(403).json({ error: "Cannot create a super admin account" });
      return;
    }
    if (role === "admin" && !isSuperAdmin(requestingRole)) {
      res.status(403).json({ error: "Only super admins can create admin accounts" });
      return;
    }

    if (allowedMenus !== undefined && allowedMenus !== null && !Array.isArray(allowedMenus)) {
      res.status(400).json({ error: "allowedMenus must be an array or null" });
      return;
    }

    const existing = await Agent.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const agent = await Agent.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: role ?? "agent",
      allowedMenus: allowedMenus ?? null,
      siteIds: Array.isArray(siteIds) ? siteIds : null,
    });
    const { passwordHash: _, ...safe } = agent.toJSON() as AgentAttributes;
    res.status(201).json(safe);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/agents/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const target = await Agent.findByPk(req.params.id);
    if (!target) { res.status(404).json({ error: "Agent not found" }); return; }

    const requestingRole = req.agent!.role;

    if (isSuperAdmin(target.role)) {
      res.status(403).json({ error: "Super admin accounts cannot be modified" });
      return;
    }
    if (isAdminOrAbove(target.role) && !isSuperAdmin(requestingRole)) {
      res.status(403).json({ error: "Only super admins can modify admin accounts" });
      return;
    }

    const { name, role, isActive, siteIds } = req.body;

    if (role === "super_admin") {
      res.status(403).json({ error: "Cannot assign super admin role" });
      return;
    }
    if (role === "admin" && !isSuperAdmin(requestingRole)) {
      res.status(403).json({ error: "Only super admins can promote users to admin" });
      return;
    }

    if (name !== undefined) target.name = name;
    if (role !== undefined) target.role = role;
    if (isActive !== undefined) target.isActive = isActive;
    if (siteIds !== undefined) target.siteIds = Array.isArray(siteIds) && siteIds.length > 0 ? siteIds : null;
    await target.save();
    const { passwordHash: _, ...safe } = target.toJSON() as AgentAttributes;
    res.json(safe);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/agents/:id/menus", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const target = await Agent.findByPk(req.params.id);
    if (!target) { res.status(404).json({ error: "Agent not found" }); return; }

    const requestingRole = req.agent!.role;

    if (isSuperAdmin(target.role)) {
      res.status(403).json({ error: "Cannot restrict super admin menu access" });
      return;
    }
    if (isAdminOrAbove(target.role) && !isSuperAdmin(requestingRole)) {
      res.status(403).json({ error: "Only super admins can modify admin menu access" });
      return;
    }

    const { allowedMenus } = req.body;
    if (allowedMenus !== null && !Array.isArray(allowedMenus)) {
      res.status(400).json({ error: "allowedMenus must be an array or null" });
      return;
    }

    await target.update({ allowedMenus: allowedMenus ?? null });
    res.json({ success: true, allowedMenus: target.allowedMenus });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/agents/:id", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const target = await Agent.findByPk(req.params.id);
    if (!target) { res.status(404).json({ error: "Agent not found" }); return; }

    if (isSuperAdmin(target.role)) {
      res.status(403).json({ error: "Super admin accounts cannot be deleted" });
      return;
    }

    if (req.agent!.id === target.id) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    await target.destroy();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
