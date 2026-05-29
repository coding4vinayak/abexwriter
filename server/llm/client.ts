/**
 * Unified `generateChat()` entrypoint.
 *
 * Resolves the API key (BYOK or platform), dispatches to the right protocol
 * client (openai-compatible / anthropic / gemini), records a usage event,
 * and returns the response.
 */
import { resolveKey, type LlmMode, KeyResolutionError } from "./keys";
import { getProvider, computeCostMicroCents, type ProviderId } from "./providers";
import { openAICompatChat, type ChatMessage, ProviderHttpError } from "./openai-compat";
import { anthropicChat } from "./anthropic";
import { geminiChat } from "./gemini";
import { recordUsage } from "./usage";

export type { ChatMessage } from "./openai-compat";

export interface GenerateChatParams {
  userId: number;
  providerId: ProviderId;
  mode: LlmMode;
  apiKeyId?: number;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
  jsonMode?: boolean;
  /** Optional metadata for usage logging. */
  feature?: string;
  bookId?: number;
  chapterId?: number;
  signal?: AbortSignal;
}

export interface GenerateChatResult {
  text: string;
  finishReason: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costMicroCents: number;
  durationMs: number;
  provider: ProviderId;
  model: string;
  mode: LlmMode;
}

export async function generateChat(p: GenerateChatParams): Promise<GenerateChatResult> {
  const provider = getProvider(p.providerId);
  const started = Date.now();
  let resolved;
  try {
    resolved = await resolveKey(p.userId, p.providerId, p.mode, p.apiKeyId);
  } catch (err) {
    // Resolution errors are recorded as failed usage events too.
    await recordUsage({
      userId: p.userId,
      provider: p.providerId,
      model: p.model,
      mode: p.mode,
      feature: p.feature,
      bookId: p.bookId,
      chapterId: p.chapterId,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costMicroCents: 0,
      durationMs: Date.now() - started,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  try {
    let resp;
    if (provider.protocol === "anthropic") {
      resp = await anthropicChat({
        baseUrl: resolved.baseUrl,
        apiKey: resolved.apiKey,
        model: p.model,
        messages: p.messages,
        temperature: p.temperature,
        maxTokens: p.maxTokens,
        topP: p.topP,
        stop: p.stop,
        signal: p.signal,
      });
    } else if (provider.protocol === "gemini") {
      resp = await geminiChat({
        baseUrl: resolved.baseUrl,
        apiKey: resolved.apiKey,
        model: p.model,
        messages: p.messages,
        temperature: p.temperature,
        maxTokens: p.maxTokens,
        topP: p.topP,
        stop: p.stop,
        signal: p.signal,
      });
    } else {
      resp = await openAICompatChat({
        providerId: p.providerId,
        baseUrl: resolved.baseUrl,
        apiKey: resolved.apiKey,
        model: p.model,
        messages: p.messages,
        temperature: p.temperature,
        maxTokens: p.maxTokens,
        topP: p.topP,
        presencePenalty: p.presencePenalty,
        frequencyPenalty: p.frequencyPenalty,
        stop: p.stop,
        jsonMode: p.jsonMode,
        signal: p.signal,
      });
    }

    const durationMs = Date.now() - started;
    const costMicroCents = computeCostMicroCents(
      p.providerId,
      p.model,
      resp.promptTokens,
      resp.completionTokens,
    );

    await recordUsage({
      userId: p.userId,
      apiKeyId: resolved.apiKeyId,
      provider: p.providerId,
      model: p.model,
      mode: p.mode,
      feature: p.feature,
      bookId: p.bookId,
      chapterId: p.chapterId,
      promptTokens: resp.promptTokens,
      completionTokens: resp.completionTokens,
      totalTokens: resp.totalTokens,
      costMicroCents,
      durationMs,
      success: true,
    });

    return {
      text: resp.text,
      finishReason: resp.finishReason,
      promptTokens: resp.promptTokens,
      completionTokens: resp.completionTokens,
      totalTokens: resp.totalTokens,
      costMicroCents,
      durationMs,
      provider: p.providerId,
      model: p.model,
      mode: p.mode,
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    await recordUsage({
      userId: p.userId,
      apiKeyId: resolved.apiKeyId,
      provider: p.providerId,
      model: p.model,
      mode: p.mode,
      feature: p.feature,
      bookId: p.bookId,
      chapterId: p.chapterId,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costMicroCents: 0,
      durationMs,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** Map a provider/protocol error to an HTTP status for the API. */
export function errorToHttpStatus(err: unknown): { status: number; message: string } {
  if (err instanceof KeyResolutionError) return { status: err.status, message: err.message };
  if (err instanceof ProviderHttpError) {
    // Pass through 401/403/404/429 verbatim; otherwise treat as 502 (bad upstream).
    const passthrough = [400, 401, 402, 403, 404, 408, 409, 422, 429];
    return {
      status: passthrough.includes(err.status) ? err.status : 502,
      message: err.message,
    };
  }
  if (err instanceof Error) return { status: 500, message: err.message };
  return { status: 500, message: "Unknown error" };
}
