import { Router } from "express";
import { AiSettings } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { testConnection, type ProviderSettings } from "../lib/ai-provider.js";

const router = Router();

router.get("/ai/settings", requireAuth, async (_req: AuthRequest, res) => {
  try {
    let settings = await AiSettings.findOne({ order: [["id", "ASC"]] });
    if (!settings) {
      settings = await AiSettings.create({
        provider: "gemini",
        model: "gemini-2.5-flash",
        apiKey: null,
        baseUrl: null,
        temperature: 0.7,
        maxTokens: 8192,
      });
    }
    res.json({
      id: settings.id,
      provider: settings.provider,
      model: settings.model,
      hasApiKey: !!settings.apiKey,
      baseUrl: settings.baseUrl,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    });
  } catch (err) {
    console.error("AI settings get error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/ai/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { provider, model, apiKey, baseUrl, temperature, maxTokens } = req.body;

    let settings = await AiSettings.findOne({ order: [["id", "ASC"]] });
    if (!settings) {
      settings = await AiSettings.create({ provider: "gemini", model: "gemini-2.5-flash", apiKey: null, baseUrl: null, temperature: 0.7, maxTokens: 8192 });
    }

    if (provider) settings.provider = provider;
    if (model) settings.model = model;
    if (apiKey !== undefined) settings.apiKey = apiKey || null;
    if (baseUrl !== undefined) settings.baseUrl = baseUrl || null;
    if (temperature !== undefined) settings.temperature = parseFloat(temperature);
    if (maxTokens !== undefined) settings.maxTokens = parseInt(maxTokens);

    await settings.save();

    res.json({
      id: settings.id,
      provider: settings.provider,
      model: settings.model,
      hasApiKey: !!settings.apiKey,
      baseUrl: settings.baseUrl,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    });
  } catch (err) {
    console.error("AI settings update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ai/settings/test", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { provider, model, apiKey, baseUrl } = req.body;

    if (!provider || !model) {
      res.status(400).json({ error: "provider and model are required" });
      return;
    }

    const testSettings: ProviderSettings = {
      provider,
      model,
      apiKey: apiKey || null,
      baseUrl: baseUrl || null,
      temperature: 0.7,
      maxTokens: 100,
    };

    const result = await testConnection(testSettings);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Test failed";
    res.json({ ok: false, message: msg });
  }
});

export default router;
