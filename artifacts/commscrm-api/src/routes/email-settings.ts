import { Router } from "express";
import { EmailSettings } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { validateDomain, testMailgunConnection, buildMailgunConfig } from "../lib/mailgun.js";

const router = Router();

router.get("/settings/email", requireAuth, async (_req: AuthRequest, res) => {
  try {
    let settings = await EmailSettings.findOne({ order: [["id", "ASC"]] });
    if (!settings) {
      settings = await EmailSettings.create({ provider: "mailgun", region: "us", isActive: false });
    }
    res.json({
      id: settings.id,
      provider: settings.provider,
      hasApiKey: !!settings.apiKey,
      domain: settings.domain,
      region: settings.region,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      isActive: settings.isActive,
    });
  } catch (err) {
    console.error("Email settings GET error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings/email", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { apiKey, domain, region, fromEmail, fromName, isActive } = req.body;

    let settings = await EmailSettings.findOne({ order: [["id", "ASC"]] });
    if (!settings) {
      settings = await EmailSettings.create({ provider: "mailgun", region: "us", isActive: false });
    }

    if (apiKey !== undefined) settings.apiKey = apiKey || null;
    if (domain !== undefined) settings.domain = domain || null;
    if (region !== undefined) settings.region = region;
    if (fromEmail !== undefined) settings.fromEmail = fromEmail || null;
    if (fromName !== undefined) settings.fromName = fromName || null;
    if (isActive !== undefined) settings.isActive = Boolean(isActive);

    await settings.save();

    res.json({
      id: settings.id,
      provider: settings.provider,
      hasApiKey: !!settings.apiKey,
      domain: settings.domain,
      region: settings.region,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      isActive: settings.isActive,
    });
  } catch (err) {
    console.error("Email settings PUT error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/settings/email/validate-domain", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { apiKey, domain, region } = req.body;

    let effectiveKey = apiKey;
    let effectiveDomain = domain;
    let effectiveRegion: "us" | "eu" = region ?? "us";

    if (!effectiveKey || !effectiveDomain) {
      const settings = await EmailSettings.findOne({ order: [["id", "ASC"]] });
      if (!settings?.apiKey || !settings?.domain) {
        res.status(400).json({ ok: false, message: "API key and domain are required" });
        return;
      }
      effectiveKey = effectiveKey || settings.apiKey;
      effectiveDomain = effectiveDomain || settings.domain;
      effectiveRegion = settings.region;
    }

    const result = await validateDomain({ apiKey: effectiveKey, domain: effectiveDomain, region: effectiveRegion, fromEmail: "", fromName: "" });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Validation failed";
    res.json({ ok: false, message: msg });
  }
});

router.post("/settings/email/test", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { testEmail, apiKey, domain, region, fromEmail, fromName } = req.body;

    if (!testEmail) {
      res.status(400).json({ ok: false, message: "testEmail is required" });
      return;
    }

    let settings = await EmailSettings.findOne({ order: [["id", "ASC"]] });
    const config = {
      apiKey: apiKey || settings?.apiKey,
      domain: domain || settings?.domain,
      region: (region || settings?.region || "us") as "us" | "eu",
      fromEmail: fromEmail || settings?.fromEmail,
      fromName: fromName || settings?.fromName || "CommsCRM",
    };

    if (!config.apiKey || !config.domain || !config.fromEmail) {
      res.json({ ok: false, message: "API key, domain, and from email are required before sending a test." });
      return;
    }

    const result = await testMailgunConnection(config as Parameters<typeof testMailgunConnection>[0], testEmail);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Test failed";
    res.json({ ok: false, message: msg });
  }
});

export default router;
