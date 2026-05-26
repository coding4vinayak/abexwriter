/**
 * Usage event recording + monthly quota check for platform mode.
 *
 * Platform-mode users are subject to a monthly free-tier cap (in micro-cents)
 * configurable via `PLATFORM_MONTHLY_QUOTA_MICRO_CENTS` (default: $5 = 500_000).
 * BYOK calls have no quota — the user's own provider account bills them.
 */
import { storage } from "../storage";
import type { LlmMode } from "./keys";
import type { ProviderId } from "./providers";

export interface UsageRecord {
  userId: number;
  apiKeyId?: number;
  provider: ProviderId;
  model: string;
  mode: LlmMode;
  feature?: string;
  bookId?: number;
  chapterId?: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costMicroCents: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}

const DEFAULT_MONTHLY_QUOTA = 500_000; // 500_000 micro-cents = $5.00

export function getMonthlyQuotaMicroCents(): number {
  const v = Number(process.env.PLATFORM_MONTHLY_QUOTA_MICRO_CENTS);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MONTHLY_QUOTA;
}

export async function recordUsage(record: UsageRecord): Promise<void> {
  try {
    await storage.createUsageEvent({
      userId: record.userId,
      apiKeyId: record.apiKeyId ?? null,
      provider: record.provider,
      model: record.model,
      mode: record.mode,
      feature: record.feature ?? null,
      bookId: record.bookId ?? null,
      chapterId: record.chapterId ?? null,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      totalTokens: record.totalTokens,
      costMicroCents: record.costMicroCents,
      durationMs: record.durationMs,
      success: record.success,
      errorMessage: record.errorMessage ?? null,
    } as any);
  } catch (err) {
    // Logging-only failure — never block the user's request.
    // eslint-disable-next-line no-console
    console.warn("[llm/usage] Failed to record usage event:", err);
  }
}

/**
 * Throws a `QuotaExceededError` if the user has consumed their platform-mode
 * monthly budget. BYOK calls bypass this check.
 */
export class QuotaExceededError extends Error {
  status = 402;
  constructor(message: string, public used: number, public limit: number) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export async function assertWithinPlatformQuota(userId: number, mode: LlmMode): Promise<void> {
  if (mode !== "platform") return;
  const limit = getMonthlyQuotaMicroCents();
  const used = await storage.getMonthlyPlatformUsage(userId);
  if (used >= limit) {
    throw new QuotaExceededError(
      `Monthly platform-mode quota of ${(limit / 100_000).toFixed(2)} USD reached. ` +
        `Add a BYOK key to keep generating.`,
      used,
      limit,
    );
  }
}
