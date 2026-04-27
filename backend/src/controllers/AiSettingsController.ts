import AiSettings from "../models/AiSettings.js";

const SUPPORTED_PROVIDERS = ["gemini"];
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

function maskKey(k: string): string {
  if (!k) return "";
  if (k.length <= 8) return "•".repeat(k.length);
  return `${"•".repeat(Math.max(0, k.length - 4))}${k.slice(-4)}`;
}

export default class AiSettingsController {
  static metadata() {
    return { providers: SUPPORTED_PROVIDERS, geminiModels: GEMINI_MODELS };
  }

  static async getSettings() {
    let row = await AiSettings.findByPk(1);
    if (!row) {
      row = await AiSettings.create({ id: 1, provider: "gemini", apiKey: "", model: "gemini-2.5-flash" });
    }
    return {
      provider: row.provider,
      model: row.model,
      hasKey: !!row.apiKey,
      maskedKey: maskKey(row.apiKey),
      updatedAt: row.updatedAt,
    };
  }

  /** Returns the raw active key + provider + model (used internally by other controllers). */
  static async getActiveConfig(): Promise<{ provider: string; apiKey: string; model: string }> {
    let row = await AiSettings.findByPk(1);
    if (!row) {
      row = await AiSettings.create({ id: 1, provider: "gemini", apiKey: "", model: "gemini-2.5-flash" });
    }
    const envFallback = process.env.GEMINI_API_KEY ?? "";
    return {
      provider: row.provider || "gemini",
      apiKey: row.apiKey || envFallback,
      model: row.model || process.env.GEMINI_MODEL || "gemini-2.5-flash",
    };
  }

  static async updateSettings(data: any) {
    let row = await AiSettings.findByPk(1);
    if (!row) {
      row = await AiSettings.create({ id: 1, provider: "gemini", apiKey: "", model: "gemini-2.5-flash" });
    }
    const updates: any = { updatedAt: new Date() };
    if (data?.provider !== undefined) {
      const p = String(data.provider).trim().toLowerCase();
      if (!SUPPORTED_PROVIDERS.includes(p)) return { error: `Unsupported provider: ${p}`, status: 400 };
      updates.provider = p;
    }
    if (data?.model !== undefined) {
      const m = String(data.model).trim();
      const targetProvider = (updates.provider as string) ?? row.provider ?? "gemini";
      if (targetProvider === "gemini" && !GEMINI_MODELS.includes(m)) {
        return { error: `Unsupported Gemini model: ${m}`, status: 400 };
      }
      updates.model = m;
    }
    if (data?.apiKey !== undefined) {
      const key = String(data.apiKey ?? "").trim();
      if (key && key.length < 10) return { error: "API key looks too short", status: 400 };
      updates.apiKey = key;
    }
    if (data?.clearKey === true) {
      updates.apiKey = "";
    }
    await AiSettings.update(updates, { where: { id: 1 } });
    return { data: await AiSettingsController.getSettings() };
  }

  static async testConnection(): Promise<{ ok: boolean; message: string }> {
    const cfg = await AiSettingsController.getActiveConfig();
    if (!cfg.apiKey) return { ok: false, message: "No API key configured." };
    if (cfg.provider !== "gemini") return { ok: false, message: `Provider ${cfg.provider} not yet supported.` };
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 8 },
          }),
        }
      );
      if (!r.ok) {
        const txt = await r.text();
        return { ok: false, message: `Gemini returned ${r.status}: ${txt.slice(0, 180)}` };
      }
      return { ok: true, message: `Connected to ${cfg.model}` };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Network error" };
    }
  }
}
