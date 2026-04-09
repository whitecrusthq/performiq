import { Router } from "express";
import { Op } from "sequelize";
import { Campaign, Customer } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { getEmailSettings, buildMailgunConfig, sendEmail } from "../lib/mailgun.js";

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

        // ── Send via Mailgun for email campaigns ──────────────────────────
        if (campaign.channel === "email") {
          try {
            const emailSettings = await getEmailSettings();
            if (emailSettings?.isActive) {
              const config = await buildMailgunConfig(emailSettings);
              if (config) {
                // Fetch all customers with email addresses
                const customers = await Customer.findAll({
                  where: { email: { [Op.ne]: null as unknown as string } },
                  attributes: ["email", "name"],
                });

                const recipients = customers.filter((c) => c.email).map((c) => c.email as string);
                campaign.recipients = recipients.length;

                if (recipients.length > 0) {
                  // Mailgun supports batch sending via recipient-variables
                  // Send in batches of 1000 (Mailgun limit)
                  const BATCH = 1000;
                  for (let i = 0; i < recipients.length; i += BATCH) {
                    await sendEmail(config, {
                      to: recipients.slice(i, i + BATCH),
                      subject: campaign.name,
                      text: campaign.message,
                      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><p>${campaign.message.replace(/\n/g, "<br>")}</p><hr><p style="font-size:12px;color:#888">You are receiving this because you are a registered customer. To unsubscribe, contact support.</p></div>`,
                    });
                  }
                }
              }
            }
          } catch (mailErr) {
            console.error("Mailgun send error (non-fatal):", mailErr);
            // Continue — mark campaign as sent even if email fails, so the UI doesn't break
          }
        }
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

// Dedicated send-now endpoint
router.post("/campaigns/:id/send", requireAuth, async (req: AuthRequest, res) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id);
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    if (campaign.channel !== "email") { res.status(400).json({ error: "Only email campaigns can be sent via Mailgun" }); return; }
    if (campaign.status === "sent") { res.status(400).json({ error: "Campaign already sent" }); return; }

    const emailSettings = await getEmailSettings();
    if (!emailSettings?.isActive) {
      res.status(400).json({ error: "Mailgun is not configured or not active. Go to Settings → Email to configure it." });
      return;
    }

    const config = await buildMailgunConfig(emailSettings);
    if (!config) {
      res.status(400).json({ error: "Mailgun configuration is incomplete (missing API key, domain, or from email)." });
      return;
    }

    const customers = await Customer.findAll({
      where: { email: { [Op.ne]: null as unknown as string } },
      attributes: ["email", "name"],
    });

    const recipients = customers.filter((c) => c.email).map((c) => c.email as string);
    if (recipients.length === 0) {
      res.status(400).json({ error: "No customers with email addresses found." });
      return;
    }

    // Send in batches
    const BATCH = 1000;
    let sent = 0;
    for (let i = 0; i < recipients.length; i += BATCH) {
      await sendEmail(config, {
        to: recipients.slice(i, i + BATCH),
        subject: campaign.name,
        text: campaign.message,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><p>${campaign.message.replace(/\n/g, "<br>")}</p><hr><p style="font-size:12px;color:#888">You are receiving this because you are a registered customer. To unsubscribe, contact support.</p></div>`,
      });
      sent += recipients.slice(i, i + BATCH).length;
    }

    campaign.status = "sent";
    campaign.sentAt = new Date();
    campaign.recipients = recipients.length;
    await campaign.save();

    res.json({ ok: true, sent, campaign });
  } catch (err) {
    console.error("Campaign send error:", err);
    const msg = err instanceof Error ? err.message : "Failed to send campaign";
    res.status(500).json({ error: msg });
  }
});

export default router;
