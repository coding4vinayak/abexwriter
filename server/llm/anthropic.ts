/**
 * Anthropic Messages API client.
 *
 * Anthropic's protocol differs from OpenAI's in two ways:
 *   1. The system prompt is a top-level `system` field, not a message with role:"system".
 *   2. The response is `content: [{type:"text", text:"…"}]`, not `choices[].message.content`.
 *
 * We accept the same `ChatMessage[]` shape as the OpenAI-compatible client and
 * adapt internally.
 */
import type { ChatMessage } from "./openai-compat";
import { ProviderHttpError } from "./openai-compat";

export interface AnthropicChatRequest {
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

export interface AnthropicChatResponse {
  text: string;
  finishReason: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  raw: unknown;
}

export async function anthropicChat(req: AnthropicChatRequest): Promise<AnthropicChatResponse> {
  // Hoist system messages.
  const systemPrompt = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const conversation = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  const body: Record<string, unknown> = {
    model: req.model,
    messages: conversation,
    max_tokens: req.maxTokens ?? 4096, // Anthropic requires max_tokens.
  };
  if (systemPrompt) body.system = systemPrompt;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.topP !== undefined) body.top_p = req.topP;
  if (req.stop && req.stop.length) body.stop_sequences = req.stop;

  const url = `${req.baseUrl.replace(/\/$/, "")}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": req.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  const text = await res.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new ProviderHttpError(res.status, "anthropic", `Non-JSON response: ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    const msg = parsed?.error?.message || parsed?.error?.type || `Anthropic returned ${res.status}`;
    throw new ProviderHttpError(res.status, "anthropic", msg, parsed);
  }

  const content: string = Array.isArray(parsed?.content)
    ? parsed.content.map((p: any) => p?.text || "").join("")
    : "";
  const promptTokens = Number(parsed?.usage?.input_tokens) || 0;
  const completionTokens = Number(parsed?.usage?.output_tokens) || 0;
  return {
    text: content,
    finishReason: parsed?.stop_reason ?? null,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    raw: parsed,
  };
}
