import { Router } from "express";
import { Op } from "sequelize";
import { Campaign, Customer } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { getEmailSettings, buildMailgunConfig, sendEmail } from "../lib/mailgun.js";
import { getMessagingSettings, buildTwilioConfig, sendSms, sendWhatsapp } from "../lib/twilio.js";

const router = Router();

router.get("/campaigns", requireAuth, async (req: AuthRequest, res) => {
  try {
    const campaigns = await Campaign.findAll({ order: [["createdAt", "DESC"]] });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/campaigns", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, channel, message, scheduledAt } = req.body;
    if (!name || !channel || !message) {
      res.status(400).json({ error: "Name, channel, and message are required" });
      return;
    }
    const campaign = await Campaign.create({
      name,
      channel,
      message,
      status: scheduledAt ? "scheduled" : "draft",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    });
    res.status(201).json(campaign);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/campaigns/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    const { name, message, status, scheduledAt } = req.body;
    if (name) campaign.name = name;
    if (message) campaign.message = message;

    if (status && status !== campaign.status) {
      campaign.status = status;
      if (status === "sent") {
        campaign.sentAt = new Date();
      }
    }

    if (scheduledAt) campaign.scheduledAt = new Date(scheduledAt);
    await campaign.save();
    res.json(campaign);
  } catch (err) {
    console.error("Campaign update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/campaigns/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    await campaign.destroy();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/campaigns/:id/send", requireAuth, async (req: AuthRequest, res) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    if (campaign.status === "sent") { res.status(400).json({ error: "Campaign already sent" }); return; }

    const channel = campaign.channel;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    if (channel === "email") {
      const emailSettings = await getEmailSettings();
      if (!emailSettings?.isActive) {
        res.status(400).json({ error: "Email (Mailgun) is not configured or not active. Go to Settings → Email to set it up." });
        return;
      }
      const config = await buildMailgunConfig(emailSettings);
      if (!config) {
        res.status(400).json({ error: "Mailgun configuration is incomplete (missing API key, domain, or from email)." });
        return;
      }

      const customers = await Customer.findAll({
        where: { email: { [Op.and]: [{ [Op.ne]: null as unknown as string }, { [Op.ne]: "" }] } },
        attributes: ["email", "name"],
      });
      const recipients = customers.filter((c) => c.email).map((c) => c.email as string);
      if (recipients.length === 0) {
        res.status(400).json({ error: "No customers with email addresses found." });
        return;
      }

      const BATCH = 1000;
      for (let i = 0; i < recipients.length; i += BATCH) {
        try {
          await sendEmail(config, {
            to: recipients.slice(i, i + BATCH),
            subject: campaign.name,
            text: campaign.message,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><p>${campaign.message.replace(/\n/g, "<br>")}</p><hr><p style="font-size:12px;color:#888">To unsubscribe, contact support.</p></div>`,
          });
          sent += recipients.slice(i, i + BATCH).length;
        } catch (err) {
          failed += recipients.slice(i, i + BATCH).length;
          errors.push(err instanceof Error ? err.message : "Email batch failed");
        }
      }
    } else if (channel === "sms") {
      const msgSettings = await getMessagingSettings();
      if (!msgSettings?.smsEnabled) {
        res.status(400).json({ error: "SMS is not enabled. Go to Settings → Messaging to configure Twilio SMS." });
        return;
      }
      const config = await buildTwilioConfig(msgSettings);
      if (!config || !config.phoneNumber) {
        res.status(400).json({ error: "Twilio SMS configuration is incomplete (missing Account SID, Auth Token, or Phone Number)." });
        return;
      }

      const customers = await Customer.findAll({
        where: { phone: { [Op.and]: [{ [Op.ne]: null as unknown as string }, { [Op.ne]: "" }] } },
        attributes: ["phone", "name"],
      });
      const phones = customers.filter((c) => c.phone).map((c) => c.phone as string);
      if (phones.length === 0) {
        res.status(400).json({ error: "No customers with phone numbers found." });
        return;
      }

      for (const phone of phones) {
        try {
          await sendSms(config, { to: phone, body: campaign.message });
          sent++;
        } catch (err) {
          failed++;
          if (errors.length < 5) errors.push(`${phone}: ${err instanceof Error ? err.message : "Failed"}`);
        }
      }
    } else if (channel === "whatsapp") {
      const msgSettings = await getMessagingSettings();
      if (!msgSettings?.whatsappEnabled) {
        res.status(400).json({ error: "WhatsApp is not enabled. Go to Settings → Messaging to configure Twilio WhatsApp." });
        return;
      }
      const config = await buildTwilioConfig(msgSettings);
      if (!config || !config.whatsappNumber) {
        res.status(400).json({ error: "Twilio WhatsApp configuration is incomplete (missing Account SID, Auth Token, or WhatsApp Number)." });
        return;
      }

      const customers = await Customer.findAll({
        where: { phone: { [Op.and]: [{ [Op.ne]: null as unknown as string }, { [Op.ne]: "" }] } },
        attributes: ["phone", "name"],
      });
      const phones = customers.filter((c) => c.phone).map((c) => c.phone as string);
      if (phones.length === 0) {
        res.status(400).json({ error: "No customers with phone numbers found." });
        return;
      }

      for (const phone of phones) {
        try {
          await sendWhatsapp(config, { to: phone, body: campaign.message });
          sent++;
        } catch (err) {
          failed++;
          if (errors.length < 5) errors.push(`${phone}: ${err instanceof Error ? err.message : "Failed"}`);
        }
      }
    } else {
      res.status(400).json({ error: `Sending is not supported for channel "${channel}". Supported: email, sms, whatsapp.` });
      return;
    }

    campaign.status = "sent";
    campaign.sentAt = new Date();
    campaign.recipients = sent + failed;
    await campaign.save();

    res.json({ ok: true, sent, failed, errors: errors.length > 0 ? errors : undefined, campaign });
  } catch (err) {
    console.error("Campaign send error:", err);
    const msg = err instanceof Error ? err.message : "Failed to send campaign";
    res.status(500).json({ error: msg });
  }
});

router.get("/campaigns/channels-status", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const emailSettings = await getEmailSettings();
    const msgSettings = await getMessagingSettings();

    res.json({
      email: { configured: !!emailSettings?.isActive, provider: "Mailgun" },
      sms: { configured: !!msgSettings?.smsEnabled, provider: "Twilio" },
      whatsapp: { configured: !!msgSettings?.whatsappEnabled, provider: "Twilio" },
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
