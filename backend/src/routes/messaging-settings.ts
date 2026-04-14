import { Router } from "express";
import { sequelize } from "../lib/database.js";
import { MessagingSettings } from "../models/MessagingSettings.js";
import { requireAuth, requireAdmin, AuthRequest } from "../middlewares/auth.js";
import { testSmsProvider } from "../lib/sms-providers.js";
import { QueryTypes } from "sequelize";

const router = Router();

async function ensureColumns() {
  try {
    await sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_messaging_settings' AND column_name='provider')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_messaging_settings' AND column_name='sms_provider')
        THEN
          ALTER TABLE crm_messaging_settings RENAME COLUMN provider TO sms_provider;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_messaging_settings' AND column_name='account_sid')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_messaging_settings' AND column_name='api_key')
        THEN
          ALTER TABLE crm_messaging_settings RENAME COLUMN account_sid TO api_key;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_messaging_settings' AND column_name='auth_token')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_messaging_settings' AND column_name='api_secret')
        THEN
          ALTER TABLE crm_messaging_settings RENAME COLUMN auth_token TO api_secret;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_messaging_settings' AND column_name='sender_id')
        THEN
          ALTER TABLE crm_messaging_settings ADD COLUMN sender_id VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_messaging_settings' AND column_name='base_url')
        THEN
          ALTER TABLE crm_messaging_settings ADD COLUMN base_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_messaging_settings' AND column_name='extra_config')
        THEN
          ALTER TABLE crm_messaging_settings ADD COLUMN extra_config JSONB;
        END IF;
      END $$;
    `);
  } catch (e) {
    console.error("ensureColumns warning:", e);
  }
}

let columnsChecked = false;

async function getSettings() {
  if (!columnsChecked) {
    await ensureColumns();
    columnsChecked = true;
  }
  let settings = await MessagingSettings.findOne({ order: [["id", "ASC"]] });
  if (!settings) {
    settings = await MessagingSettings.create({ smsProvider: "twilio" });
  }
  return settings;
}

router.get("/messaging-settings", requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const settings = await getSettings();
    res.json({
      id: settings.id,
      smsProvider: settings.smsProvider,
      hasApiKey: !!settings.apiKey,
      hasApiSecret: !!settings.apiSecret,
      senderId: settings.senderId,
      baseUrl: settings.baseUrl,
      extraConfig: settings.extraConfig,
      twilioWhatsappNumber: settings.twilioWhatsappNumber,
      smsEnabled: settings.smsEnabled,
      whatsappEnabled: settings.whatsappEnabled,
    });
  } catch (err) {
    console.error("Get messaging settings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/messaging-settings", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const settings = await getSettings();

    const { smsProvider, apiKey, apiSecret, senderId, baseUrl, extraConfig, twilioWhatsappNumber, smsEnabled, whatsappEnabled } = req.body;

    if (smsProvider !== undefined) settings.smsProvider = smsProvider;
    if (apiKey !== undefined) settings.apiKey = apiKey || null;
    if (apiSecret !== undefined) settings.apiSecret = apiSecret || null;
    if (senderId !== undefined) settings.senderId = senderId || null;
    if (baseUrl !== undefined) settings.baseUrl = baseUrl || null;
    if (extraConfig !== undefined) settings.extraConfig = extraConfig || null;
    if (twilioWhatsappNumber !== undefined) settings.twilioWhatsappNumber = twilioWhatsappNumber || null;
    if (smsEnabled !== undefined) settings.smsEnabled = smsEnabled;
    if (whatsappEnabled !== undefined) settings.whatsappEnabled = whatsappEnabled;

    await settings.save();

    res.json({
      id: settings.id,
      smsProvider: settings.smsProvider,
      hasApiKey: !!settings.apiKey,
      hasApiSecret: !!settings.apiSecret,
      senderId: settings.senderId,
      baseUrl: settings.baseUrl,
      extraConfig: settings.extraConfig,
      twilioWhatsappNumber: settings.twilioWhatsappNumber,
      smsEnabled: settings.smsEnabled,
      whatsappEnabled: settings.whatsappEnabled,
    });
  } catch (err) {
    console.error("Update messaging settings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/messaging-settings/test", requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const settings = await MessagingSettings.findOne({ order: [["id", "ASC"]] });
    if (!settings) {
      res.status(400).json({ error: "Messaging settings not configured" });
      return;
    }
    const result = await testSmsProvider(settings);
    res.json(result);
  } catch (err) {
    console.error("Test messaging settings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
