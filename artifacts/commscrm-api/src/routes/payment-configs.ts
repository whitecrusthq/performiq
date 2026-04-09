import { Router } from "express";
import { PaymentConfig } from "../models/PaymentConfig.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

function mask(val: string | null): string | null {
  if (!val) return null;
  if (val.length <= 8) return "•".repeat(val.length);
  return val.slice(0, 4) + "•".repeat(Math.min(val.length - 8, 20)) + val.slice(-4);
}

function serialize(c: PaymentConfig, reveal = false) {
  return {
    id: c.id,
    provider: c.provider,
    isEnabled: c.isEnabled,
    isLiveMode: c.isLiveMode,
    publicKey: c.publicKey,
    secretKey: reveal ? c.secretKey : mask(c.secretKey),
    webhookSecret: reveal ? c.webhookSecret : mask(c.webhookSecret),
    webhookToken: c.webhookToken,
    hasSecretKey: !!c.secretKey,
    hasWebhookSecret: !!c.webhookSecret,
    metadata: c.metadata,
    createdAt: c.createdAt,
  };
}

// List all payment configs
router.get("/payment-configs", requireAuth, async (_req, res) => {
  try {
    const configs = await PaymentConfig.findAll({ order: [["provider", "ASC"]] });
    res.json(configs.map((c) => serialize(c)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single config with revealed secrets (for reveal button)
router.get("/payment-configs/:provider/reveal", requireAuth, async (req: AuthRequest, res) => {
  try {
    const cfg = await PaymentConfig.findOne({ where: { provider: req.params.provider } });
    if (!cfg) { res.status(404).json({ error: "Not found" }); return; }
    res.json(serialize(cfg, true));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upsert a payment config
router.put("/payment-configs/:provider", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { provider } = req.params;
    const { isEnabled, isLiveMode, publicKey, secretKey, webhookSecret, metadata } = req.body as {
      isEnabled?: boolean;
      isLiveMode?: boolean;
      publicKey?: string;
      secretKey?: string;
      webhookSecret?: string;
      metadata?: Record<string, unknown>;
    };

    const [cfg, created] = await PaymentConfig.findOrCreate({
      where: { provider: provider as any },
      defaults: { provider: provider as any },
    });

    if (isEnabled !== undefined) cfg.isEnabled = isEnabled;
    if (isLiveMode !== undefined) cfg.isLiveMode = isLiveMode;
    if (publicKey !== undefined) cfg.publicKey = publicKey || null;
    if (secretKey !== undefined && secretKey !== "") cfg.secretKey = secretKey;
    if (webhookSecret !== undefined && webhookSecret !== "") cfg.webhookSecret = webhookSecret || null;
    if (metadata) cfg.metadata = { ...(cfg.metadata ?? {}), ...metadata };

    await cfg.save();
    res.status(created ? 201 : 200).json(serialize(cfg));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Regenerate webhook token
router.post("/payment-configs/:provider/regenerate-webhook", requireAuth, async (req: AuthRequest, res) => {
  try {
    const cfg = await PaymentConfig.findOne({ where: { provider: req.params.provider } });
    if (!cfg) { res.status(404).json({ error: "Not found" }); return; }
    cfg.webhookToken = [...Array(48)].map(() => Math.random().toString(36)[2]).join("");
    await cfg.save();
    res.json(serialize(cfg));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Test connection
router.post("/payment-configs/:provider/test", requireAuth, async (req: AuthRequest, res) => {
  try {
    const cfg = await PaymentConfig.findOne({ where: { provider: req.params.provider } });
    if (!cfg || !cfg.secretKey) {
      res.status(400).json({ success: false, message: "No secret key configured." });
      return;
    }

    const key = cfg.secretKey;
    let testResult: { success: boolean; message: string };

    try {
      switch (cfg.provider) {
        case "stripe": {
          const r = await fetch("https://api.stripe.com/v1/balance", {
            headers: { Authorization: `Bearer ${key}` },
          });
          const body = await r.json() as { error?: { message: string } };
          testResult = r.ok
            ? { success: true, message: "Stripe credentials verified successfully." }
            : { success: false, message: body?.error?.message ?? "Invalid Stripe key." };
          break;
        }
        case "paystack": {
          const r = await fetch("https://api.paystack.co/balance", {
            headers: { Authorization: `Bearer ${key}` },
          });
          const body = await r.json() as { status?: boolean; message?: string };
          testResult = body?.status
            ? { success: true, message: "Paystack credentials verified successfully." }
            : { success: false, message: body?.message ?? "Invalid Paystack key." };
          break;
        }
        case "flutterwave": {
          const r = await fetch("https://api.flutterwave.com/v3/banks/NG?per_page=1", {
            headers: { Authorization: `Bearer ${key}` },
          });
          const body = await r.json() as { status?: string; message?: string };
          testResult = body?.status === "success"
            ? { success: true, message: "Flutterwave credentials verified successfully." }
            : { success: false, message: body?.message ?? "Invalid Flutterwave key." };
          break;
        }
        case "paypal": {
          const clientId = cfg.publicKey ?? "";
          const r = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${clientId}:${key}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
          });
          testResult = r.ok
            ? { success: true, message: "PayPal credentials verified successfully." }
            : { success: false, message: "Invalid PayPal Client ID or Secret." };
          break;
        }
        case "square": {
          const base = cfg.isLiveMode
            ? "https://connect.squareup.com"
            : "https://connect.squareupsandbox.com";
          const r = await fetch(`${base}/v2/locations`, {
            headers: { Authorization: `Bearer ${key}`, "Square-Version": "2024-01-17" },
          });
          testResult = r.ok
            ? { success: true, message: "Square credentials verified successfully." }
            : { success: false, message: "Invalid Square access token." };
          break;
        }
        default:
          testResult = { success: false, message: "Unknown provider." };
      }
    } catch {
      testResult = { success: false, message: "Connection failed. Check network or credentials." };
    }

    res.json(testResult);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
