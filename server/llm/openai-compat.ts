/**
 * Generic OpenAI-compatible /v1/chat/completions client.
 *
 * Works for OpenAI, DeepSeek, Groq, Together, OpenRouter, Mistral, Perplexity,
 * xAI, Fireworks, Anyscale, Ollama, and any user-supplied custom endpoint that
 * follows the OpenAI Chat Completions spec.
 *
 * No SDK dependency — uses native fetch (Node ≥ 18). This keeps the server lean
 * and avoids version-pinning a dozen SDKs.
 */
import { getProvider, type ProviderId } from "./providers";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
}

export interface OpenAICompatRequest {
  providerId: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  /** Stop sequences. */
  stop?: string[];
  /** JSON-mode response. Not all providers support this. */
  jsonMode?: boolean;
  /** Optional abort signal for cancellation. */
  signal?: AbortSignal;
}

export interface OpenAICompatResponse {
  text: string;
  finishReason: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  raw: unknown;
}

export class ProviderHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly providerId: string,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

export async function openAICompatChat(req: OpenAICompatRequest): Promise<OpenAICompatResponse> {
  const provider = getProvider(req.providerId);
  const url = `${req.baseUrl.replace(/\/$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (req.apiKey) {
    headers[provider.authHeader] = `${provider.authScheme}${req.apiKey}`;
  }
  // OpenRouter recommends these for analytics; harmless elsewhere.
  if (req.providerId === "openrouter") {
    headers["HTTP-Referer"] = process.env.PUBLIC_APP_URL || "https://abexwriter.local";
    headers["X-Title"] = "AbexWriter";
  }

  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
  if (req.topP !== undefined) body.top_p = req.topP;
  if (req.presencePenalty !== undefined) body.presence_penalty = req.presencePenalty;
  if (req.frequencyPenalty !== undefined) body.frequency_penalty = req.frequencyPenalty;
  if (req.stop && req.stop.length) body.stop = req.stop;
  if (req.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: req.signal,
  });

  const text = await res.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new ProviderHttpError(res.status, req.providerId, `Non-JSON response from ${req.providerId}: ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const message =
      parsed?.error?.message ||
      parsed?.error?.type ||
      parsed?.message ||
      `${req.providerId} returned ${res.status}`;
    throw new ProviderHttpError(res.status, req.providerId, message, parsed);
  }

  // Standard shape: choices[0].message.content + usage.{prompt,completion,total}_tokens.
  const choice = parsed?.choices?.[0];
  const content: string =
    choice?.message?.content ??
    // Some providers return content as an array of parts (e.g. {type:'text', text:'…'}).
    (Array.isArray(choice?.message?.content)
      ? choice.message.content.map((p: any) => p?.text || "").join("")
      : "") ??
    "";

  const usage = parsed?.usage ?? {};
  return {
    text: content,
    finishReason: choice?.finish_reason ?? null,
    promptTokens: Number(usage.prompt_tokens) || 0,
    completionTokens: Number(usage.completion_tokens) || 0,
    totalTokens: Number(usage.total_tokens) || 0,
    raw: parsed,
  };
}
