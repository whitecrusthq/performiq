import { Router } from "express";
import crypto from "crypto";
import { Channel, Customer, Conversation, Message, AiSettings, KnowledgeDoc, AiException } from "../models/index.js";
import { getAiSettings, generateText } from "../lib/ai-provider.js";

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

async function buildKnowledgeContext(): Promise<string> {
  try {
    const docs = await KnowledgeDoc.findAll({ order: [["createdAt", "ASC"]] });
    if (docs.length === 0) return "";
    const sections = docs.map((d) => `### ${d.originalName}\n${d.content}`).join("\n\n---\n\n");
    return `\n\n## Knowledge Base\n${sections}\n\n---\n`;
  } catch { return ""; }
}

async function buildExceptionContext(): Promise<string> {
  try {
    const all = await AiException.findAll({ where: { isActive: true }, order: [["createdAt", "ASC"]] });
    if (all.length === 0) return "";
    const exceptions = all.filter((e) => e.type === "exception");
    const complianceDocs = all.filter((e) => e.type === "compliance");
    let result = "";
    if (exceptions.length > 0) {
      const list = exceptions.map((e, i) => `${i + 1}. "${e.phrase}"${e.reason ? ` — ${e.reason}` : ""}`).join("\n");
      result += `\n\n## RESTRICTED TOPICS\nDo NOT answer questions about:\n${list}\n`;
    }
    if (complianceDocs.length > 0) {
      const sections = complianceDocs.map((d) => `### ${d.phrase}\n${d.content || ""}`).join("\n\n");
      result += `\n\n## COMPLIANCE\n${sections}\n`;
    }
    return result;
  } catch { return ""; }
}

async function generateWidgetAiReply(conversation: Conversation, customerName: string): Promise<string | null> {
  try {
    const settings = await getAiSettings();
    if (!settings.apiKey && !process.env.AI_INTEGRATIONS_GEMINI_API_KEY && !process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
      return null;
    }

    const messages = await Message.findAll({
      where: { conversationId: conversation.id },
      order: [["createdAt", "ASC"]],
      limit: 20,
    });

    const knowledgeContext = await buildKnowledgeContext();
    const exceptionContext = await buildExceptionContext();

    const systemPrompt = `You are a helpful, friendly customer service assistant for a business.
Customer: ${customerName}.
Keep responses concise (1-3 sentences), professional, warm, and helpful.
If you cannot answer a question, offer to connect them with a human agent.
Do NOT mention that you are an AI unless directly asked.${knowledgeContext}${exceptionContext}`;

    const historyMessages = messages.map((m) => ({
      role: (m.sender === "customer" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));

    const reply = await generateText(settings, systemPrompt, historyMessages);
    return reply?.trim() || null;
  } catch (err) {
    console.error("Widget AI reply error:", err);
    return null;
  }
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

    let aiReply: string | null = null;
    try {
      aiReply = await generateWidgetAiReply(conversation, name);
      if (aiReply) {
        await Message.create({
          conversationId: conversation.id,
          sender: "bot",
          content: aiReply,
          isRead: true,
        });
        await Conversation.update({ lastMessageAt: new Date() }, { where: { id: conversation.id } });
      }
    } catch (aiErr) {
      console.error("Widget AI error (non-fatal):", aiErr);
    }

    res.json({
      success: true,
      conversationId: conversation.id,
      aiReply: aiReply || null,
    });
  } catch (err) {
    console.error("Widget message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/widget/history", async (req, res) => {
  try {
    const { widgetId, visitorId } = req.query as Record<string, string>;
    if (!widgetId || !visitorId) {
      res.status(400).json({ error: "widgetId and visitorId are required" });
      return;
    }

    const channel = await Channel.findOne({ where: { type: "widget", webhookVerifyToken: widgetId } });
    if (!channel) {
      res.json({ messages: [] });
      return;
    }

    const identifier = `widget_${visitorId}`;
    const customer = await Customer.findOne({ where: { phone: identifier } });
    if (!customer) {
      res.json({ messages: [] });
      return;
    }

    const conversation = await Conversation.findOne({
      where: { customerId: customer.id, status: ["open", "pending"] as unknown as string },
    });
    if (!conversation) {
      res.json({ messages: [] });
      return;
    }

    const messages = await Message.findAll({
      where: { conversationId: conversation.id },
      order: [["createdAt", "ASC"]],
      limit: 50,
      attributes: ["sender", "content", "createdAt"],
    });

    res.json({
      messages: messages.map((m) => ({
        sender: m.sender === "customer" ? "user" : "bot",
        content: m.content,
        time: m.createdAt,
      })),
    });
  } catch (err) {
    console.error("Widget history error:", err);
    res.json({ messages: [] });
  }
});

router.get("/widget/config", async (req, res) => {
  try {
    const widgetId = req.query.id as string;
    if (!widgetId) {
      res.json({ valid: false });
      return;
    }

    const channel = await Channel.findOne({ where: { type: "widget", webhookVerifyToken: widgetId } });
    if (!channel) {
      res.json({ valid: false });
      return;
    }

    res.json({
      valid: true,
      name: channel.name || "Support Chat",
      config: channel.config || {},
    });
  } catch (err) {
    console.error("Widget config error:", err);
    res.json({ valid: false });
  }
});

router.get("/widget.js", async (req, res) => {
  const widgetId = req.query.id as string | undefined;
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const baseUrl = `${proto}://${req.get("host")}`;

  const js = `(function(){
"use strict";
if(window.__ccrmLoaded)return;
window.__ccrmLoaded=true;

var cfg=window.__commscrm||{};
var wId=cfg.widgetId||${widgetId?JSON.stringify(widgetId):"null"};
if(!wId)return;

var color=cfg.color||"#7c3aed";
var greeting=cfg.greeting||"Hi! How can we help you today?";
var position=cfg.position||"bottom-right";
var title=cfg.title||"Support Chat";
var apiBase=cfg.apiBase||${JSON.stringify(baseUrl)};
var apiPaths=["/api","/crm-api"];

var visitorId=(function(){
  try{
    var v=localStorage.getItem("_ccrm_vid");
    if(v)return v;
    v="v"+Math.random().toString(36).slice(2)+Date.now().toString(36);
    localStorage.setItem("_ccrm_vid",v);
    return v;
  }catch(e){return "v"+Math.random().toString(36).slice(2)+Date.now().toString(36);}
})();

var side=position==="bottom-left"?"left:24px":"right:24px";
var chatOpen=false;
var sending=false;
var resolvedApiPath=null;

var style=document.createElement("style");
style.textContent=\`
#_ccrm-btn{position:fixed;bottom:24px;\${side};width:60px;height:60px;border-radius:50%;background:\${color};color:#fff;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;z-index:99998;transition:all .3s cubic-bezier(.4,0,.2,1)}
#_ccrm-btn:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(0,0,0,.3)}
#_ccrm-btn.open{transform:rotate(90deg) scale(1.08)}
#_ccrm-badge{position:absolute;top:-2px;right:-2px;background:#ef4444;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;display:none;align-items:center;justify-content:center;border:2px solid #fff}
#_ccrm-box{position:fixed;bottom:96px;\${side};width:370px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;opacity:0;transform:translateY(16px) scale(.96);transition:opacity .25s,transform .25s}
#_ccrm-box.open{display:flex;opacity:1;transform:translateY(0) scale(1)}
#_ccrm-hdr{background:\${color};color:#fff;padding:16px 20px;font-weight:600;font-size:15px;display:flex;align-items:center;gap:10px;min-height:56px;flex-shrink:0}
#_ccrm-hdr .dot{width:10px;height:10px;background:#4ade80;border-radius:50%;flex-shrink:0;box-shadow:0 0 0 2px rgba(74,222,128,.3)}
#_ccrm-close{margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;padding:4px;opacity:.8;transition:opacity .2s}
#_ccrm-close:hover{opacity:1}
#_ccrm-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;background:#fafafa}
#_ccrm-msgs::-webkit-scrollbar{width:4px}
#_ccrm-msgs::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px}
.ccrm-msg{max-width:85%;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.5;word-wrap:break-word;animation:ccrmFadeIn .3s ease}
@keyframes ccrmFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.ccrm-msg.bot{background:#fff;color:#1f2937;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.ccrm-msg.usr{background:\${color};color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.ccrm-msg.typing{background:#fff;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.08);padding:12px 18px}
.ccrm-dots{display:flex;gap:4px}
.ccrm-dots span{width:7px;height:7px;background:#aaa;border-radius:50%;animation:ccrmBounce 1.4s infinite ease-in-out both}
.ccrm-dots span:nth-child(1){animation-delay:-.32s}
.ccrm-dots span:nth-child(2){animation-delay:-.16s}
@keyframes ccrmBounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
.ccrm-time{font-size:10px;color:#9ca3af;margin-top:2px;padding:0 4px}
.ccrm-time.right{text-align:right}
#_ccrm-inp{display:flex;gap:8px;padding:12px 16px;border-top:1px solid #f0f0f0;background:#fff;flex-shrink:0}
#_ccrm-txt{flex:1;padding:10px 16px;border:1.5px solid #e5e7eb;border-radius:24px;font-size:14px;outline:none;font-family:inherit;resize:none;transition:border-color .2s}
#_ccrm-txt:focus{border-color:\${color}}
#_ccrm-txt::placeholder{color:#9ca3af}
#_ccrm-send{background:\${color};color:#fff;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
#_ccrm-send:hover{filter:brightness(1.1)}
#_ccrm-send:disabled{opacity:.5;cursor:not-allowed}
#_ccrm-powered{text-align:center;padding:6px;font-size:10px;color:#bbb;background:#fff;border-top:1px solid #f5f5f5}
@media(max-width:480px){#_ccrm-box{width:100vw;height:100vh;max-height:100vh;bottom:0;left:0;right:0;border-radius:0}#_ccrm-btn.open{display:none}}
\`;
document.head.appendChild(style);

var btn=document.createElement("button");
btn.id="_ccrm-btn";
btn.setAttribute("aria-label","Open chat");
btn.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><div id="_ccrm-badge">0</div>';
document.body.appendChild(btn);

var box=document.createElement("div");
box.id="_ccrm-box";
box.innerHTML='<div id="_ccrm-hdr"><div class="dot"></div><span>'+escHtml(title)+'</span><button id="_ccrm-close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div id="_ccrm-msgs"></div><div id="_ccrm-inp"><input id="_ccrm-txt" type="text" placeholder="Type a message..." autocomplete="off"/><button id="_ccrm-send" aria-label="Send">&#10148;</button></div><div id="_ccrm-powered">Powered by CommsCRM</div>';
document.body.appendChild(box);

var msgsEl=document.getElementById("_ccrm-msgs");
var txtEl=document.getElementById("_ccrm-txt");
var sendBtn=document.getElementById("_ccrm-send");

function escHtml(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}

function scrollDown(){setTimeout(function(){msgsEl.scrollTop=msgsEl.scrollHeight;},50);}

function addMsg(text,cls,skipAnim){
  var m=document.createElement("div");
  m.className="ccrm-msg "+cls;
  m.textContent=text;
  if(skipAnim)m.style.animation="none";
  msgsEl.appendChild(m);
  scrollDown();
  return m;
}

function showTyping(){
  var m=document.createElement("div");
  m.className="ccrm-msg typing";
  m.id="_ccrm-typing";
  m.innerHTML='<div class="ccrm-dots"><span></span><span></span><span></span></div>';
  msgsEl.appendChild(m);
  scrollDown();
  return m;
}

function hideTyping(){
  var t=document.getElementById("_ccrm-typing");
  if(t)t.remove();
}

function toggle(){
  chatOpen=!chatOpen;
  box.classList.toggle("open",chatOpen);
  btn.classList.toggle("open",chatOpen);
  if(chatOpen){txtEl.focus();scrollDown();}
}

btn.onclick=toggle;
document.getElementById("_ccrm-close").onclick=function(e){e.stopPropagation();toggle();};

async function apiCall(method,path,body){
  if(!resolvedApiPath){
    for(var i=0;i<apiPaths.length;i++){
      try{
        var testRes=await fetch(apiBase+apiPaths[i]+"/widget/config?id="+encodeURIComponent(wId));
        if(testRes.ok){resolvedApiPath=apiPaths[i];break;}
      }catch(e){}
    }
    if(!resolvedApiPath)resolvedApiPath=apiPaths[0];
  }
  var url=apiBase+resolvedApiPath+path;
  var opts={method:method,headers:{"Content-Type":"application/json"}};
  if(body)opts.body=JSON.stringify(body);
  var r=await fetch(url,opts);
  if(!r.ok)throw new Error("HTTP "+r.status);
  return r.json();
}

async function loadHistory(){
  try{
    var data=await apiCall("GET","/widget/history?widgetId="+encodeURIComponent(wId)+"&visitorId="+encodeURIComponent(visitorId));
    if(data.messages&&data.messages.length>0){
      msgsEl.innerHTML="";
      for(var i=0;i<data.messages.length;i++){
        var m=data.messages[i];
        addMsg(m.content,m.sender==="user"?"usr":"bot",true);
      }
    }else{
      addMsg(greeting,"bot",true);
    }
  }catch(e){
    console.error("CommsCRM: history load failed",e);
    if(!msgsEl.children.length)addMsg(greeting,"bot",true);
  }
}

async function send(){
  if(sending)return;
  var msg=txtEl.value.trim();
  if(!msg)return;
  txtEl.value="";
  sendBtn.disabled=true;
  sending=true;

  addMsg(msg,"usr");
  showTyping();

  try{
    var data=await apiCall("POST","/widget/message",{
      widgetId:wId,visitorId:visitorId,visitorName:cfg.visitorName||null,message:msg
    });
    hideTyping();
    if(data.aiReply){
      addMsg(data.aiReply,"bot");
    }else{
      addMsg("Thanks! An agent will reply shortly.","bot");
    }
  }catch(e){
    hideTyping();
    addMsg("Sorry, something went wrong. Please try again.","bot");
    console.error("CommsCRM: send failed",e);
  }finally{
    sending=false;
    sendBtn.disabled=false;
    txtEl.focus();
  }
}

sendBtn.onclick=send;
txtEl.onkeydown=function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}};

loadHistory();
})();`;

  res.set("Content-Type", "application/javascript; charset=utf-8");
  res.set("Cache-Control", "public, max-age=60");
  res.set("Access-Control-Allow-Origin", "*");
  res.send(js);
});

export default router;
