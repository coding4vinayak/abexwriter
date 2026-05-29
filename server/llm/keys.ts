/**
 * Resolves the API key + base URL to use for a given (userId, provider, mode).
 *
 *   mode = "byok"     → user-supplied key from `userApiKeys`. 404 if not found.
 *   mode = "platform" → platform-managed key from process.env. 503 if not set.
 *
 * Returned shape is consumed by openai-compat / anthropic / gemini clients.
 */
import { storage } from "../storage";
import { decrypt } from "./crypto";
import { getProvider, type ProviderId } from "./providers";

export type LlmMode = "byok" | "platform";

export interface ResolvedKey {
  apiKey: string;
  baseUrl: string;
  mode: LlmMode;
  /** Set when mode === 'byok' so we can update lastUsedAt and link usage events. */
  apiKeyId?: number;
}

export class KeyResolutionError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "KeyResolutionError";
  }
}

export async function resolveKey(
  userId: number,
  providerId: ProviderId,
  mode: LlmMode,
  /** Optional explicit BYOK key id. If omitted in BYOK mode, the most recently
   *  used active key for the provider is selected. */
  apiKeyId?: number,
): Promise<ResolvedKey> {
  const provider = getProvider(providerId);

  if (mode === "byok") {
    const record = apiKeyId
      ? await storage.getUserApiKey(apiKeyId, userId)
      : await storage.getActiveUserApiKeyForProvider(userId, providerId);

    if (!record) {
      throw new KeyResolutionError(
        404,
        `No active BYOK key found for provider "${providerId}". Add one in Settings → API Keys.`,
      );
    }
    if (!record.isActive) {
      throw new KeyResolutionError(403, `API key "${record.label}" is disabled.`);
    }

    const apiKey = decrypt(record.encryptedKey);
    const baseUrl = record.baseUrl || provider.baseUrl;
    if (!baseUrl) {
      throw new KeyResolutionError(
        400,
        `Provider "${providerId}" requires a baseUrl. Edit the API key and provide one.`,
      );
    }
    // Fire-and-forget; failure to update lastUsedAt should not block the call.
    storage.touchUserApiKey(record.id).catch(() => undefined);
    return { apiKey, baseUrl, mode, apiKeyId: record.id };
  }

  // Platform mode.
  const envKey = process.env[provider.platformEnvVar];
  if (!provider.baseUrl) {
    throw new KeyResolutionError(
      400,
      `Provider "${providerId}" cannot run in platform mode (no baseUrl).`,
    );
  }
  if (provider.requiresApiKey && !envKey) {
    throw new KeyResolutionError(
      503,
      `Platform mode for "${providerId}" is not configured. Set ${provider.platformEnvVar} on the server, or use BYOK.`,
    );
  }
  return {
    apiKey: envKey || "",
    baseUrl: provider.baseUrl,
    mode,
  };
}
