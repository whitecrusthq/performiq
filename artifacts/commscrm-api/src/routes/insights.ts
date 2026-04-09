import { Router } from "express";
import { Op, fn, col, literal } from "sequelize";
import { Conversation, Customer, Message } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

function parseDateRange(query: Record<string, unknown>): { since: Date; until: Date; days: number } {
  const until = new Date();
  until.setHours(23, 59, 59, 999);

  if (query.startDate && query.endDate) {
    const since = new Date(query.startDate as string);
    since.setHours(0, 0, 0, 0);
    const end = new Date(query.endDate as string);
    end.setHours(23, 59, 59, 999);
    const days = Math.max(1, Math.ceil((end.getTime() - since.getTime()) / 86400000));
    return { since, until: end, days };
  }

  const days = Math.max(1, parseInt((query.days as string) ?? "30"));
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  return { since, until, days };
}

// ── Keyword taxonomy ──────────────────────────────────────────────────────────

const ISSUE_CATEGORIES: Record<string, { keywords: string[]; color: string; icon: string }> = {
  "Shipping & Delivery": {
    keywords: ["deliver", "delivery", "shipment", "shipping", "tracking", "track", "courier", "arrived", "arrival", "delay", "delayed", "lost", "package", "dispatch", "transit", "carrier", "dhl", "fedex", "ups", "usps"],
    color: "#6366f1",
    icon: "🚚",
  },
  "Returns & Refunds": {
    keywords: ["refund", "return", "money back", "exchange", "cancel", "cancellation", "damaged", "broken on arrival", "wrong item", "reverse"],
    color: "#f59e0b",
    icon: "↩️",
  },
  "Billing & Payment": {
    keywords: ["charge", "invoice", "payment", "bill", "billing", "transaction", "overcharged", "duplicate", "debit", "credit card", "checkout", "price", "discount", "coupon", "promo", "fee", "cost"],
    color: "#10b981",
    icon: "💳",
  },
  "Technical Support": {
    keywords: ["not working", "broken", "error", "bug", "crash", "slow", "loading", "won't load", "can't login", "reset", "password", "access", "log in", "sign in", "account locked", "freeze", "glitch"],
    color: "#ef4444",
    icon: "🔧",
  },
  "Product Information": {
    keywords: ["product", "item", "description", "size", "colour", "color", "material", "feature", "specification", "availability", "stock", "in stock", "out of stock", "how does", "what is", "warranty", "guarantee"],
    color: "#8b5cf6",
    icon: "📦",
  },
  "Account & Profile": {
    keywords: ["account", "profile", "email", "username", "password", "subscription", "membership", "update my", "change my", "personal", "data", "privacy"],
    color: "#06b6d4",
    icon: "👤",
  },
  "Complaints": {
    keywords: ["complaint", "unhappy", "disappointed", "terrible", "awful", "unacceptable", "disgusting", "worst", "rude", "ridiculous", "never again", "appalling", "horrible"],
    color: "#f43f5e",
    icon: "😤",
  },
};

const COMPLIANCE_KEYWORDS = [
  { keyword: "legal action", severity: "high" },
  { keyword: "lawyer", severity: "high" },
  { keyword: "lawsuit", severity: "high" },
  { keyword: "sue", severity: "high" },
  { keyword: "court", severity: "high" },
  { keyword: "solicitor", severity: "high" },
  { keyword: "trading standards", severity: "high" },
  { keyword: "ombudsman", severity: "high" },
  { keyword: "fraud", severity: "high" },
  { keyword: "scam", severity: "high" },
  { keyword: "unauthorized charge", severity: "high" },
  { keyword: "unauthorised charge", severity: "high" },
  { keyword: "gdpr", severity: "medium" },
  { keyword: "data protection", severity: "medium" },
  { keyword: "discrimination", severity: "medium" },
  { keyword: "harassment", severity: "medium" },
  { keyword: "false advertising", severity: "medium" },
  { keyword: "mis-sold", severity: "medium" },
  { keyword: "misrepresentation", severity: "medium" },
  { keyword: "report you", severity: "medium" },
  { keyword: "regulatory", severity: "medium" },
  { keyword: "illegal", severity: "medium" },
];

const QUESTION_STOPWORDS = new Set([
  "i", "me", "my", "we", "you", "your", "it", "its", "the", "a", "an", "and", "or", "but", "is", "are",
  "was", "were", "be", "been", "do", "did", "does", "have", "has", "had", "this", "that", "these", "those",
  "in", "on", "at", "to", "of", "for", "with", "from", "by", "about", "can", "will", "would", "could",
  "should", "please", "help", "hello", "hi", "hey", "thanks", "thank", "know", "get", "want", "need",
  "how", "what", "when", "where", "why", "who", "which", "any", "some", "still", "yet", "just", "already",
  "not", "no", "yes", "so", "also", "then", "there", "here", "if", "more", "much", "many",
]);

function normalise(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function extractBigrams(text: string): string[] {
  const words = normalise(text).split(" ").filter((w) => w.length > 2 && !QUESTION_STOPWORDS.has(w));
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) bigrams.push(`${words[i]} ${words[i + 1]}`);
  bigrams.push(...words); // unigrams too
  return bigrams;
}

function categoryScore(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};
  for (const [cat, { keywords }] of Object.entries(ISSUE_CATEGORIES)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > 0) scores[cat] = score;
  }
  return scores;
}

// ── Main insights endpoint ────────────────────────────────────────────────────

router.get("/insights/customer", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { since, until, days } = parseDateRange(req.query as Record<string, unknown>);

    // Fetch all customer messages in the period
    const messages = await Message.findAll({
      where: { sender: "customer", createdAt: { [Op.between]: [since, until] } },
      attributes: ["id", "conversationId", "content", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit: 5000,
    }) as unknown as Array<{ id: number; conversationId: number; content: string; createdAt: Date }>;

    // ── Top questions ──────────────────────────────────────────────────────
    const questionMessages = messages.filter((m) => m.content.includes("?") && m.content.trim().length > 10);
    const bigramFreq: Record<string, number> = {};
    for (const m of questionMessages) {
      for (const bg of extractBigrams(m.content)) {
        bigramFreq[bg] = (bigramFreq[bg] ?? 0) + 1;
      }
    }
    const topTopics = Object.entries(bigramFreq)
      .filter(([, c]) => c >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([phrase, count]) => ({ phrase, count }));

    // Sample top actual questions per topic
    const topQuestionSamples: Array<{ topic: string; count: number; sample: string }> = topTopics.map(({ phrase, count }) => {
      const sample = questionMessages.find((m) => normalise(m.content).includes(phrase));
      return { topic: phrase, count, sample: sample?.content.slice(0, 120) ?? phrase };
    });

    // ── Issue categories ───────────────────────────────────────────────────
    const catCounts: Record<string, { count: number; conversationIds: Set<number>; color: string; icon: string }> = {};
    for (const [cat, meta] of Object.entries(ISSUE_CATEGORIES)) {
      catCounts[cat] = { count: 0, conversationIds: new Set(), color: meta.color, icon: meta.icon };
    }

    for (const m of messages) {
      const scores = categoryScore(m.content);
      for (const [cat, score] of Object.entries(scores)) {
        if (score > 0 && catCounts[cat]) {
          catCounts[cat].conversationIds.add(m.conversationId);
        }
      }
    }

    const topIssues = Object.entries(catCounts)
      .map(([name, { conversationIds, color, icon }]) => ({ name, count: conversationIds.size, color, icon }))
      .filter((i) => i.count > 0)
      .sort((a, b) => b.count - a.count);

    // ── Product mentions ───────────────────────────────────────────────────
    const productTermFreq: Record<string, number> = {};
    const productContextWords = ["order", "product", "item", "bought", "purchased", "received", "package", "model", "version"];
    for (const m of messages) {
      const lower = m.content.toLowerCase();
      // Check if message has product context
      const hasContext = productContextWords.some((w) => lower.includes(w));
      if (!hasContext) continue;
      // Extract capitalised or quoted terms (potential product names)
      const capitalised = m.content.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g) ?? [];
      const quoted = m.content.match(/"([^"]{3,40})"|'([^']{3,40})'/g) ?? [];
      const candidates = [...capitalised, ...quoted.map((q) => q.replace(/['"]/g, ""))];
      for (const term of candidates) {
        if (QUESTION_STOPWORDS.has(term.toLowerCase())) continue;
        if (term.length < 3) continue;
        productTermFreq[term] = (productTermFreq[term] ?? 0) + 1;
      }
    }

    // Also extract from bigrams that aren't stopwords and appear with product context
    const allBigrams: Record<string, number> = {};
    for (const m of messages) {
      const lower = m.content.toLowerCase();
      const hasProductContext = productContextWords.some((w) => lower.includes(w));
      if (!hasProductContext) continue;
      for (const bg of extractBigrams(m.content)) {
        if (bg.split(" ").every((w) => !QUESTION_STOPWORDS.has(w))) {
          allBigrams[bg] = (allBigrams[bg] ?? 0) + 1;
        }
      }
    }

    const topProducts = [
      ...Object.entries(productTermFreq).map(([name, count]) => ({ name, count, source: "mention" })),
      ...Object.entries(allBigrams).filter(([, c]) => c >= 2).map(([name, count]) => ({ name, count, source: "phrase" })),
    ]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .filter((p) => p.count >= 2);

    // ── Compliance flags ───────────────────────────────────────────────────
    const complianceHits: Array<{
      conversationId: number;
      messageId: number;
      keyword: string;
      severity: string;
      snippet: string;
      createdAt: Date;
    }> = [];

    for (const m of messages) {
      const lower = m.content.toLowerCase();
      for (const { keyword, severity } of COMPLIANCE_KEYWORDS) {
        if (lower.includes(keyword)) {
          const idx = lower.indexOf(keyword);
          const start = Math.max(0, idx - 30);
          const end = Math.min(m.content.length, idx + keyword.length + 60);
          complianceHits.push({
            conversationId: m.conversationId,
            messageId: m.id,
            keyword,
            severity,
            snippet: `...${m.content.slice(start, end).trim()}...`,
            createdAt: m.createdAt,
          });
          break; // one flag per message
        }
      }
    }

    // Deduplicate by conversation (keep highest severity per conversation)
    const complianceByConv: Record<number, typeof complianceHits[0]> = {};
    for (const hit of complianceHits) {
      const existing = complianceByConv[hit.conversationId];
      if (!existing || (hit.severity === "high" && existing.severity === "medium")) {
        complianceByConv[hit.conversationId] = hit;
      }
    }
    const topCompliance = Object.values(complianceByConv)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20);

    // ── Conversation tag analysis (graceful — column may not exist) ──────────
    let topTags: Array<{ tag: string; count: number }> = [];
    try {
      const taggedConvs = await Conversation.findAll({
        where: { tags: { [Op.ne]: null as unknown as string }, createdAt: { [Op.gte]: since } },
        attributes: ["tags"],
        raw: true,
      }) as unknown as Array<{ tags: string[] | string }>;

      const tagFreq: Record<string, number> = {};
      for (const { tags } of taggedConvs) {
        const tagList = Array.isArray(tags) ? tags : (typeof tags === "string" && tags.startsWith("[") ? JSON.parse(tags) : [tags]);
        for (const t of tagList.filter(Boolean)) {
          tagFreq[String(t)] = (tagFreq[String(t)] ?? 0) + 1;
        }
      }
      topTags = Object.entries(tagFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .map(([tag, count]) => ({ tag, count }));
    } catch {
      // tags column may not exist in this schema
    }

    // ── Summary stats ──────────────────────────────────────────────────────
    const totalCustomerMessages = messages.length;
    const totalQuestions = questionMessages.length;
    const totalCompliance = topCompliance.length;
    const topIssueCategory = topIssues[0]?.name ?? "None";

    res.json({
      period: `Last ${days} days`,
      summary: {
        totalCustomerMessages,
        totalQuestions,
        questionsRate: totalCustomerMessages > 0 ? Math.round((totalQuestions / totalCustomerMessages) * 100) : 0,
        totalCompliance,
        topIssueCategory,
      },
      topQuestions: topQuestionSamples,
      topIssues,
      topProducts,
      complianceFlags: topCompliance,
      topTags,
    });
  } catch (err) {
    console.error("Insights error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── AI-powered categorisation (on demand) ────────────────────────────────────

router.post("/insights/ai-summary", requireAuth, async (req: AuthRequest, res) => {
  try {
    const days = parseInt((req.body.days as string) ?? "30");
    const since = new Date();
    since.setDate(since.getDate() - days);

    const messages = await Message.findAll({
      where: { sender: "customer", createdAt: { [Op.gte]: since } },
      attributes: ["content"],
      order: [["createdAt", "DESC"]],
      limit: 100,
    });

    const sample = messages.map((m) => m.content).slice(0, 50).join("\n---\n");

    const { getAiSettings, generateText } = await import("../lib/ai-provider.js");
    const settings = await getAiSettings();

    const prompt = `You are a customer service analyst. Analyse the following customer messages and produce a concise summary report in this exact JSON format:

{
  "keyThemes": [{"theme": "string", "description": "string", "urgency": "high|medium|low"}],
  "productsMentioned": ["string"],
  "sentimentOverall": "positive|neutral|negative|mixed",
  "sentimentNote": "1-2 sentence explanation",
  "recommendations": ["string"]
}

Customer messages (sample of last ${days} days):
${sample}

Return ONLY valid JSON, no markdown fences.`;

    const rawText = await generateText(settings, "You are a customer service analyst.", [
      { role: "user", content: prompt },
    ]);

    try {
      const json = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      res.json({ ok: true, data: json });
    } catch {
      res.json({ ok: true, data: { rawText } });
    }
  } catch (err) {
    console.error("AI summary error:", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

// ── Product Demand Intelligence ───────────────────────────────────────────────

// Phrases that indicate a customer is searching for / asking about a product
const SEARCH_INTENT_TRIGGERS = [
  "do you have", "do you sell", "do you carry", "do you stock",
  "looking for", "searching for", "search for",
  "can i get", "can i buy", "can i order",
  "is there a", "is there any", "are there any",
  "need a", "need an", "need some", "i need",
  "want a", "want an", "want to buy", "want to order", "want to get",
  "find me", "get me",
  "price of", "price for", "how much is", "how much for", "how much does",
  "availability of", "available", "in stock", "do you have in stock",
  "where can i find", "where can i get",
  "do you supply",
];

// Phrases in agent/bot messages indicating unavailability
const NOT_AVAILABLE_TRIGGERS = [
  "out of stock", "sold out", "not available", "no longer available",
  "not in stock", "don't have", "do not have", "we don't stock",
  "we don't carry", "not currently available", "currently unavailable",
  "temporarily unavailable", "discontinued", "no stock",
  "we don't sell", "we don't supply", "unfortunately we",
  "we don't offer", "not something we",
];

function extractProductTerm(content: string, trigger: string): string | null {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(trigger);
  if (idx === -1) return null;
  // Take up to 5 words after the trigger
  const after = content.slice(idx + trigger.length).trim();
  const words = after.split(/\s+/).slice(0, 5);
  // Remove punctuation from last word
  if (words.length === 0) return null;
  const term = words.join(" ").replace(/[?.!,;]+$/, "").trim();
  return term.length >= 3 ? term : null;
}

function normaliseTerm(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

router.get("/insights/product-demand", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { since, until, days } = parseDateRange(req.query as Record<string, unknown>);

    // Fetch all customer messages in the period
    const customerMessages = await Message.findAll({
      where: { sender: "customer", createdAt: { [Op.between]: [since, until] } },
      attributes: ["id", "conversationId", "content", "createdAt"],
      order: [["createdAt", "ASC"]],
      limit: 8000,
    }) as unknown as Array<{ id: number; conversationId: number; content: string; createdAt: Date }>;

    // Fetch all agent/bot messages (for unavailability detection)
    const agentMessages = await Message.findAll({
      where: { sender: { [Op.in]: ["agent", "bot"] }, createdAt: { [Op.between]: [since, until] } },
      attributes: ["id", "conversationId", "content", "createdAt"],
      order: [["createdAt", "ASC"]],
      limit: 8000,
    }) as unknown as Array<{ id: number; conversationId: number; content: string; createdAt: Date }>;

    // ── Detect product searches ─────────────────────────────────────────────
    const searchEvents: Array<{ conversationId: number; term: string; date: Date }> = [];

    for (const msg of customerMessages) {
      const lower = msg.content.toLowerCase();
      for (const trigger of SEARCH_INTENT_TRIGGERS) {
        if (lower.includes(trigger)) {
          const term = extractProductTerm(msg.content, trigger);
          if (term) {
            searchEvents.push({ conversationId: msg.conversationId, term, date: msg.createdAt });
            break; // one search per message
          }
        }
      }
    }

    // ── Detect not-available responses ─────────────────────────────────────
    // A conversation is "not available" if an agent/bot message in a conversation that had
    // a product search contains an unavailability phrase
    const searchConversationIds = new Set(searchEvents.map((e) => e.conversationId));
    const notAvailableConvIds = new Set<number>();
    const notAvailableEvents: Array<{ date: Date }> = [];

    for (const msg of agentMessages) {
      if (!searchConversationIds.has(msg.conversationId)) continue;
      const lower = msg.content.toLowerCase();
      const isUnavailable = NOT_AVAILABLE_TRIGGERS.some((t) => lower.includes(t));
      if (isUnavailable && !notAvailableConvIds.has(msg.conversationId)) {
        notAvailableConvIds.add(msg.conversationId);
        notAvailableEvents.push({ date: msg.createdAt });
      }
    }

    // ── Resolved search conversations (proxy for search-to-order) ──────────
    let resolvedSearchConvs = 0;
    if (searchConversationIds.size > 0) {
      const convIds = [...searchConversationIds];
      const resolved = await Conversation.count({
        where: { id: { [Op.in]: convIds }, status: "resolved" },
      });
      resolvedSearchConvs = resolved;
    }

    // ── Unique products in demand ───────────────────────────────────────────
    const productFreq: Record<string, number> = {};
    for (const ev of searchEvents) {
      const key = normaliseTerm(ev.term);
      if (key.length >= 3) {
        productFreq[key] = (productFreq[key] ?? 0) + 1;
      }
    }

    const topSearchedProducts = Object.entries(productFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([term, count]) => ({
        term,
        count,
        notAvailableCount: notAvailableEvents.length,
        display: term.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      }));

    const uniqueProductCount = Object.keys(productFreq).length;
    const totalSearches = searchEvents.length;
    const notAvailableRate = totalSearches > 0
      ? Math.round((notAvailableConvIds.size / searchConversationIds.size) * 1000) / 10
      : 0;
    const searchToOrderRate = searchConversationIds.size > 0
      ? Math.round((resolvedSearchConvs / searchConversationIds.size) * 1000) / 10
      : 0;

    // ── Daily trend data ────────────────────────────────────────────────────
    const dayMs = 86400000;
    const trendMap: Record<string, { searches: number; notAvailable: number }> = {};

    // Initialise all days in range
    for (let d = 0; d <= days; d++) {
      const dt = new Date(since.getTime() + d * dayMs);
      if (dt > until) break;
      const key = dt.toISOString().slice(0, 10);
      trendMap[key] = { searches: 0, notAvailable: 0 };
    }

    for (const ev of searchEvents) {
      const key = new Date(ev.date).toISOString().slice(0, 10);
      if (trendMap[key]) trendMap[key].searches++;
    }

    for (const ev of notAvailableEvents) {
      const key = new Date(ev.date).toISOString().slice(0, 10);
      if (trendMap[key]) trendMap[key].notAvailable++;
    }

    const trendData = Object.entries(trendMap).map(([date, counts]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      ...counts,
    }));

    // ── Top categories / demand by channel ─────────────────────────────────
    // For each product search, check which conversation channel it came from
    const convChannels: Record<number, string> = {};
    if (searchConversationIds.size > 0) {
      const convs = await Conversation.findAll({
        where: { id: { [Op.in]: [...searchConversationIds] } },
        attributes: ["id", "channel"],
        raw: true,
      }) as unknown as Array<{ id: number; channel: string }>;
      for (const c of convs) convChannels[c.id] = c.channel;
    }

    const channelBreakdown: Record<string, number> = {};
    for (const ev of searchEvents) {
      const ch = convChannels[ev.conversationId] ?? "unknown";
      channelBreakdown[ch] = (channelBreakdown[ch] ?? 0) + 1;
    }

    res.json({
      period: `Last ${days} days`,
      stats: {
        totalSearches,
        uniqueProductCount,
        notAvailableRate,
        searchToOrderRate,
        searchConversationCount: searchConversationIds.size,
        notAvailableCount: notAvailableConvIds.size,
      },
      topSearchedProducts,
      trendData,
      channelBreakdown,
    });
  } catch (err) {
    console.error("Product demand error:", err);
    res.status(500).json({ error: "Failed to compute product demand insights" });
  }
});

export default router;
