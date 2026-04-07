import { Router } from "express";
import crypto from "crypto";
import { Channel, Customer, Conversation, Message } from "../models/index.js";

const router = Router();

type SupportedChannel = "whatsapp" | "facebook" | "instagram" | "widget";

async function findOrCreateCustomer(phone: string, name: string, channel: SupportedChannel) {
  let customer = await Customer.findOne({ where: { phone } });
  if (!customer) {
    customer = await Customer.create({
      name: name || phone,
      phone,
      channel,
      tags: [],
    });
  }
  return customer;
}

async function findOrCreateConversation(customerId: number, channel: SupportedChannel) {
  let conversation = await Conversation.findOne({
    where: { customerId, status: ["open", "pending"] as unknown as string },
  });
  if (!conversation) {
    conversation = await Conversation.create({
      customerId,
      channel,
      status: "open",
      unreadCount: 0,
    });
  }
  return conversation;
}

async function storeIncomingMessage(conversation: Conversation, text: string) {
  await Message.create({
    conversationId: conversation.id,
    sender: "customer",
    content: text,
    isRead: false,
  });

  conversation.unreadCount = (conversation.unreadCount || 0) + 1;
  conversation.lastMessageAt = new Date();
  await conversation.save();
}

function verifyMetaSignature(body: string, signature: string, appSecret: string): boolean {
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(body).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

router.get("/webhooks/whatsapp", async (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query as Record<string, string>;
  if (mode !== "subscribe") {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }

  const channel = await Channel.findOne({ where: { type: "whatsapp" } });
  if (!channel || channel.webhookVerifyToken !== token) {
    res.status(403).json({ error: "Invalid verify token" });
    return;
  }

  res.send(challenge);
});

router.post("/webhooks/whatsapp", async (req, res) => {
  const body = req.body;

  if (body.object !== "whatsapp_business_account") {
    res.sendStatus(200);
    return;
  }

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value;

        for (const message of value.messages || []) {
          if (message.type !== "text") continue;

          const phone = message.from;
          const text = message.text?.body || "";
          const profileName = value.contacts?.[0]?.profile?.name || phone;

          const customer = await findOrCreateCustomer(`+${phone}`, profileName, "whatsapp");
          const conversation = await findOrCreateConversation(customer.id, "whatsapp");
          await storeIncomingMessage(conversation, text);
        }
      }
    }
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
  }

  res.sendStatus(200);
});

router.get("/webhooks/facebook", async (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query as Record<string, string>;
  if (mode !== "subscribe") {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }

  const channel = await Channel.findOne({ where: { type: "facebook" } });
  if (!channel || channel.webhookVerifyToken !== token) {
    res.status(403).json({ error: "Invalid verify token" });
    return;
  }

  res.send(challenge);
});

router.post("/webhooks/facebook", async (req, res) => {
  const body = req.body;

  if (body.object !== "page") {
    res.sendStatus(200);
    return;
  }

  try {
    for (const entry of body.entry || []) {
      for (const messaging of entry.messaging || []) {
        if (!messaging.message?.text) continue;

        const senderId = messaging.sender.id;
        const text = messaging.message.text;

        const customer = await findOrCreateCustomer(senderId, `FB User ${senderId.slice(-4)}`, "facebook");
        const conversation = await findOrCreateConversation(customer.id, "facebook");
        await storeIncomingMessage(conversation, text);
      }
    }
  } catch (err) {
    console.error("Facebook webhook error:", err);
  }

  res.sendStatus(200);
});

router.get("/webhooks/instagram", async (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query as Record<string, string>;
  if (mode !== "subscribe") {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }

  const channel = await Channel.findOne({ where: { type: "instagram" } });
  if (!channel || channel.webhookVerifyToken !== token) {
    res.status(403).json({ error: "Invalid verify token" });
    return;
  }

  res.send(challenge);
});

router.post("/webhooks/instagram", async (req, res) => {
  const body = req.body;

  if (body.object !== "instagram") {
    res.sendStatus(200);
    return;
  }

  try {
    for (const entry of body.entry || []) {
      for (const messaging of entry.messaging || []) {
        if (!messaging.message?.text) continue;

        const senderId = messaging.sender.id;
        const text = messaging.message.text;

        const customer = await findOrCreateCustomer(senderId, `IG User ${senderId.slice(-4)}`, "instagram");
        const conversation = await findOrCreateConversation(customer.id, "instagram");
        await storeIncomingMessage(conversation, text);
      }
    }
  } catch (err) {
    console.error("Instagram webhook error:", err);
  }

  res.sendStatus(200);
});

router.post("/webhooks/simulate", async (req, res) => {
  try {
    const { channel, customerName, customerPhone, message } = req.body;
    if (!channel || !message) {
      res.status(400).json({ error: "channel and message required" });
      return;
    }

    const validChannels: SupportedChannel[] = ["whatsapp", "facebook", "instagram", "widget"];
    if (!validChannels.includes(channel as SupportedChannel)) {
      res.status(400).json({ error: `Unsupported channel: ${channel}` });
      return;
    }

    const phone = channel === "widget"
      ? `widget_${customerPhone || `visitor_${Date.now()}`}`
      : (customerPhone || `+sim_${Date.now()}`);
    const name = customerName || (channel === "widget" ? "Website Visitor" : "Test Customer");

    const customer = await findOrCreateCustomer(phone, name, channel as SupportedChannel);
    const conversation = await findOrCreateConversation(customer.id, channel as SupportedChannel);
    await storeIncomingMessage(conversation, message);

    res.json({ success: true, conversationId: conversation.id, customerId: customer.id });
  } catch (err) {
    console.error("Simulate error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/widget/message", async (req, res) => {
  try {
    const { widgetId, visitorId, visitorName, message } = req.body;
    if (!widgetId || !message) {
      res.status(400).json({ error: "widgetId and message are required" });
      return;
    }

    const channel = await Channel.findOne({ where: { type: "widget", webhookVerifyToken: widgetId } });
    if (!channel) {
      res.status(404).json({ error: "Widget not found" });
      return;
    }

    const identifier = `widget_${visitorId || `anon_${Date.now()}`}`;
    const name = visitorName || "Website Visitor";

    const customer = await findOrCreateCustomer(identifier, name, "widget");
    const conversation = await findOrCreateConversation(customer.id, "widget");
    await storeIncomingMessage(conversation, message);

    res.json({ success: true, conversationId: conversation.id });
  } catch (err) {
    console.error("Widget message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/widget.js", async (req, res) => {
  const widgetId = req.query.id as string | undefined;
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const js = `(function() {
  var cfg = window.__commscrm || {};
  var wId = cfg.widgetId || ${widgetId ? JSON.stringify(widgetId) : "null"};
  if (!wId) return;

  var color = cfg.color || "#7c3aed";
  var greeting = cfg.greeting || "Hi! How can we help you today?";
  var position = cfg.position || "bottom-right";
  var apiBase = cfg.apiBase || ${JSON.stringify(baseUrl + "/api")};
  var visitorId = (localStorage.getItem("_ccrm_vid") || (function(){
    var v = "v" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("_ccrm_vid", v);
    return v;
  })());

  var side = position === "bottom-left" ? "left:24px" : "right:24px";

  var style = document.createElement("style");
  style.textContent = [
    "#_ccrm-btn{position:fixed;bottom:24px;" + side + ";width:56px;height:56px;border-radius:50%;background:" + color + ";color:#fff;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;z-index:99998;transition:transform .2s}",
    "#_ccrm-btn:hover{transform:scale(1.08)}",
    "#_ccrm-box{position:fixed;bottom:96px;" + side + ";width:340px;max-height:480px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;z-index:99999;font-family:system-ui,sans-serif}",
    "#_ccrm-box.open{display:flex}",
    "#_ccrm-hdr{background:" + color + ";color:#fff;padding:16px;font-weight:600;font-size:15px;display:flex;align-items:center;gap:10px}",
    "#_ccrm-hdr .dot{width:8px;height:8px;background:#4ade80;border-radius:50%}",
    "#_ccrm-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}",
    "#_ccrm-msgs .msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.4}",
    "#_ccrm-msgs .bot{background:#f3f4f6;align-self:flex-start;border-bottom-left-radius:4px}",
    "#_ccrm-msgs .usr{background:" + color + ";color:#fff;align-self:flex-end;border-bottom-right-radius:4px}",
    "#_ccrm-inp{display:flex;gap:8px;padding:12px;border-top:1px solid #f0f0f0}",
    "#_ccrm-inp input{flex:1;padding:8px 12px;border:1px solid #e5e7eb;border-radius:20px;font-size:13px;outline:none}",
    "#_ccrm-inp input:focus{border-color:" + color + "}",
    "#_ccrm-inp button{background:" + color + ";color:#fff;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}"
  ].join("");
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "_ccrm-btn";
  btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  document.body.appendChild(btn);

  var box = document.createElement("div");
  box.id = "_ccrm-box";
  box.innerHTML = '<div id="_ccrm-hdr"><div class="dot"></div><span>Support Chat</span></div>' +
    '<div id="_ccrm-msgs"><div class="msg bot">' + greeting + '</div></div>' +
    '<div id="_ccrm-inp"><input id="_ccrm-txt" type="text" placeholder="Type a message..."/><button id="_ccrm-send">&#10148;</button></div>';
  document.body.appendChild(box);

  btn.onclick = function() { box.classList.toggle("open"); };

  function addMsg(text, cls) {
    var m = document.createElement("div");
    m.className = "msg " + cls;
    m.textContent = text;
    document.getElementById("_ccrm-msgs").appendChild(m);
    document.getElementById("_ccrm-msgs").scrollTop = 9999;
  }

  function send() {
    var txt = document.getElementById("_ccrm-txt");
    var msg = txt.value.trim();
    if (!msg) return;
    txt.value = "";
    addMsg(msg, "usr");
    fetch(apiBase + "/widget/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetId: wId, visitorId: visitorId, visitorName: cfg.visitorName || null, message: msg })
    }).then(function(r){ return r.json(); }).then(function(){
      setTimeout(function(){ addMsg("Thanks! An agent will reply shortly.", "bot"); }, 600);
    }).catch(function(){
      addMsg("Sorry, couldn\\'t send. Please try again.", "bot");
    });
  }

  document.getElementById("_ccrm-send").onclick = send;
  document.getElementById("_ccrm-txt").onkeydown = function(e){ if(e.key==="Enter") send(); };
})();`;

  res.set("Content-Type", "application/javascript; charset=utf-8");
  res.set("Cache-Control", "public, max-age=300");
  res.send(js);
});

export default router;
