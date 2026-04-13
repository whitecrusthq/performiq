import { Router } from "express";
import { MessagingSettings } from "../models/MessagingSettings.js";
import { requireAuth, requireAdmin, AuthRequest } from "../middlewares/auth.js";
import { buildTwilioConfig, testTwilioConnection } from "../lib/twilio.js";

const router = Router();

router.get("/messaging-settings", requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    let settings = await MessagingSettings.findOne({ order: [["id", "ASC"]] });
    if (!settings) {
      settings = await MessagingSettings.create({ provider: "twilio" });
    }
    res.json({
      id: settings.id,
      provider: settings.provider,
      hasAccountSid: !!settings.accountSid,
      hasAuthToken: !!settings.authToken,
      twilioPhoneNumber: settings.twilioPhoneNumber,
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
    let settings = await MessagingSettings.findOne({ order: [["id", "ASC"]] });
    if (!settings) {
      settings = await MessagingSettings.create({ provider: "twilio" });
    }

    const { accountSid, authToken, twilioPhoneNumber, twilioWhatsappNumber, smsEnabled, whatsappEnabled } = req.body;

    if (accountSid !== undefined) settings.accountSid = accountSid || null;
    if (authToken !== undefined) settings.authToken = authToken || null;
    if (twilioPhoneNumber !== undefined) settings.twilioPhoneNumber = twilioPhoneNumber || null;
    if (twilioWhatsappNumber !== undefined) settings.twilioWhatsappNumber = twilioWhatsappNumber || null;
    if (smsEnabled !== undefined) settings.smsEnabled = smsEnabled;
    if (whatsappEnabled !== undefined) settings.whatsappEnabled = whatsappEnabled;

    await settings.save();

    res.json({
      id: settings.id,
      provider: settings.provider,
      hasAccountSid: !!settings.accountSid,
      hasAuthToken: !!settings.authToken,
      twilioPhoneNumber: settings.twilioPhoneNumber,
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
    if (!settings || !settings.accountSid || !settings.authToken) {
      res.status(400).json({ error: "Twilio credentials not configured" });
      return;
    }

    const config = await buildTwilioConfig(settings);
    if (!config) {
      res.status(400).json({ error: "Twilio configuration is incomplete" });
      return;
    }

    const result = await testTwilioConnection(config);
    res.json(result);
  } catch (err) {
    console.error("Test messaging settings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
