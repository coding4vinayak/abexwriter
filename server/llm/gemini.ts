/**
 * Google Gemini (Generative Language API) client.
 *
 * Gemini uses a `generateContent` endpoint with a `contents: [{role, parts:[{text}]}]`
 * structure and a `systemInstruction` for system prompts. The key is passed as a
 * `?key=` query parameter.
 */
import type { ChatMessage } from "./openai-compat";
import { ProviderHttpError } from "./openai-compat";

export interface GeminiChatRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  signal?: AbortSignal;
}

export interface GeminiChatResponse {
  text: string;
  finishReason: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  raw: unknown;
}

export async function geminiChat(req: GeminiChatRequest): Promise<GeminiChatResponse> {
  const systemText = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = { contents };
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
  const generationConfig: Record<string, unknown> = {};
  if (req.temperature !== undefined) generationConfig.temperature = req.temperature;
  if (req.maxTokens !== undefined) generationConfig.maxOutputTokens = req.maxTokens;
  if (req.topP !== undefined) generationConfig.topP = req.topP;
  if (req.stop && req.stop.length) generationConfig.stopSequences = req.stop;
  if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;

  const url = `${req.baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(
    req.model,
  )}:generateContent?key=${encodeURIComponent(req.apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  const text = await res.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new ProviderHttpError(res.status, "gemini", `Non-JSON response: ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    const msg = parsed?.error?.message || `Gemini returned ${res.status}`;
    throw new ProviderHttpError(res.status, "gemini", msg, parsed);
  }

  const candidate = parsed?.candidates?.[0];
  const content: string = Array.isArray(candidate?.content?.parts)
    ? candidate.content.parts.map((p: any) => p?.text || "").join("")
    : "";
  const promptTokens = Number(parsed?.usageMetadata?.promptTokenCount) || 0;
  const completionTokens = Number(parsed?.usageMetadata?.candidatesTokenCount) || 0;
  return {
    text: content,
    finishReason: candidate?.finishReason ?? null,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    raw: parsed,
  };
}
