import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { AiSettings } from "../models/index.js";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProviderSettings {
  provider: string;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_SETTINGS: ProviderSettings = {
  provider: "gemini",
  model: "gemini-2.5-flash",
  apiKey: null,
  baseUrl: null,
  temperature: 0.7,
  maxTokens: 8192,
};

export async function getAiSettings(): Promise<ProviderSettings> {
  try {
    const row = await AiSettings.findOne({ order: [["id", "ASC"]] });
    if (!row) return DEFAULT_SETTINGS;
    return {
      provider: row.provider,
      model: row.model,
      apiKey: row.apiKey,
      baseUrl: row.baseUrl,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getGemini(settings: ProviderSettings) {
  const baseUrl = settings.baseUrl || process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const apiKey = settings.apiKey || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Gemini not configured. Add an API key or use the built-in Replit integration.");
  const useReplitProxy = !settings.apiKey;
  return new GoogleGenAI({
    apiKey,
    httpOptions: useReplitProxy ? { apiVersion: "", baseUrl } : { baseUrl: settings.baseUrl || undefined },
  });
}

function getOpenAI(settings: ProviderSettings) {
  if (!settings.apiKey) throw new Error("OpenAI API key is required.");
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl || "https://api.openai.com/v1",
  });
}

function getAnthropic(settings: ProviderSettings) {
  if (settings.apiKey) {
    return new Anthropic({ apiKey: settings.apiKey });
  }
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  if (!baseURL || !apiKey) throw new Error("Anthropic API key is required.");
  return new Anthropic({ baseURL, apiKey });
}

function getCustomOpenAI(settings: ProviderSettings) {
  if (!settings.baseUrl) throw new Error("Custom provider requires a Base URL.");
  return new OpenAI({
    apiKey: settings.apiKey || "sk-custom",
    baseURL: settings.baseUrl,
  });
}

export async function generateText(settings: ProviderSettings, systemPrompt: string, messages: AiMessage[]): Promise<string> {
  const { provider, model, temperature, maxTokens } = settings;

  if (provider === "gemini") {
    const ai = getGemini(settings);
    const geminiMsgs = [
      { role: "user" as const, parts: [{ text: systemPrompt }] },
      { role: "model" as const, parts: [{ text: "Understood." }] },
      ...messages.filter(m => m.content).map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: m.content }],
      })),
    ];
    const res = await ai.models.generateContent({ model, contents: geminiMsgs, config: { maxOutputTokens: maxTokens, temperature } });
    return res.text ?? "";
  }

  if (provider === "anthropic") {
    const anthropic = getAnthropic(settings);
    const anthropicMsgs = messages.filter(m => m.content).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));
    const res = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: anthropicMsgs.slice(-10),
    });
    return res.content[0].type === "text" ? res.content[0].text : "";
  }

  if (provider === "openai" || provider === "custom") {
    const openai = provider === "openai" ? getOpenAI(settings) : getCustomOpenAI(settings);
    const openaiMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.filter(m => m.content).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];
    const res = await openai.chat.completions.create({
      model,
      messages: openaiMsgs.slice(-11),
      max_tokens: maxTokens,
      temperature,
    });
    return res.choices[0]?.message?.content ?? "";
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export async function streamText(
  settings: ProviderSettings,
  systemPrompt: string,
  messages: AiMessage[],
  onChunk: (text: string) => void
): Promise<void> {
  const { provider, model, temperature, maxTokens } = settings;

  if (provider === "gemini") {
    const ai = getGemini(settings);
    const geminiMsgs = [
      { role: "user" as const, parts: [{ text: systemPrompt }] },
      { role: "model" as const, parts: [{ text: "Understood." }] },
      ...messages.filter(m => m.content).map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: m.content }],
      })),
    ];
    const stream = await ai.models.generateContentStream({ model, contents: geminiMsgs, config: { maxOutputTokens: maxTokens, temperature } });
    for await (const chunk of stream) {
      if (chunk.text) onChunk(chunk.text);
    }
    return;
  }

  if (provider === "anthropic") {
    const anthropic = getAnthropic(settings);
    const anthropicMsgs = messages.filter(m => m.content).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));
    const stream = anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: anthropicMsgs.slice(-10),
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        onChunk(event.delta.text);
      }
    }
    return;
  }

  if (provider === "openai" || provider === "custom") {
    const openai = provider === "openai" ? getOpenAI(settings) : getCustomOpenAI(settings);
    const openaiMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.filter(m => m.content).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];
    const stream = await openai.chat.completions.create({
      model,
      messages: openaiMsgs.slice(-11),
      max_tokens: maxTokens,
      temperature,
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) onChunk(text);
    }
    return;
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export async function testConnection(settings: ProviderSettings): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await generateText(settings, "You are a helpful assistant.", [{ role: "user", content: "Say 'OK' and nothing else." }]);
    if (result) return { ok: true, message: `Connected! Response: "${result.slice(0, 80).trim()}"` };
    return { ok: false, message: "No response returned from model." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}
