/**
 * Provider catalog.
 *
 * Most providers expose an OpenAI-compatible /v1/chat/completions endpoint, so
 * a single client (`openai-compat.ts`) handles all of them. Anthropic and
 * Gemini have their own native protocols and use dedicated clients.
 *
 * Pricing is in micro-cents per 1M tokens (1 micro-cent = $0.00000001).
 * Sources: official provider pricing pages as of 2025. Treat as estimates —
 * the platform should periodically refresh these from a config file.
 */

export type ProviderId =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "groq"
  | "together"
  | "openrouter"
  | "mistral"
  | "perplexity"
  | "xai"
  | "fireworks"
  | "anyscale"
  | "gemini"
  | "ollama"
  | "custom";

export type ProviderProtocol = "openai-compatible" | "anthropic" | "gemini";

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow: number;
  /** Cost per 1M input tokens, in micro-cents. */
  inputCostPer1M: number;
  /** Cost per 1M output tokens, in micro-cents. */
  outputCostPer1M: number;
  capabilities?: ("chat" | "vision" | "tools" | "json")[];
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  protocol: ProviderProtocol;
  baseUrl: string | null;          // null for "custom" (user supplies)
  /** Header name for the API key. */
  authHeader: "Authorization" | "x-api-key" | "X-API-Key";
  /** Authorization scheme prefix. Empty string means "raw key, no prefix". */
  authScheme: string;
  /** Env var name used in platform mode. */
  platformEnvVar: string;
  /** Whether the provider needs an API key (Ollama can run keyless). */
  requiresApiKey: boolean;
  /** Where to get an API key (shown in the BYOK UI). */
  signupUrl: string;
  /** Curated list of models. The free-text `modelId` overrides this. */
  models: ModelInfo[];
}

// Pricing constants (per 1M tokens, in micro-cents = $/100M).
// $1.00 per 1M tokens = 100,000 micro-cents per 1M tokens.
const PRICE = (dollarsPer1M: number) => Math.round(dollarsPer1M * 100_000);

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    protocol: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "OPENAI_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o",          label: "GPT-4o",          contextWindow: 128_000, inputCostPer1M: PRICE(2.50), outputCostPer1M: PRICE(10.00), capabilities: ["chat", "vision", "tools", "json"] },
      { id: "gpt-4o-mini",     label: "GPT-4o mini",     contextWindow: 128_000, inputCostPer1M: PRICE(0.15), outputCostPer1M: PRICE(0.60),  capabilities: ["chat", "vision", "tools", "json"] },
      { id: "gpt-4.1",         label: "GPT-4.1",         contextWindow: 1_000_000, inputCostPer1M: PRICE(2.00), outputCostPer1M: PRICE(8.00), capabilities: ["chat", "tools", "json"] },
      { id: "gpt-4.1-mini",    label: "GPT-4.1 mini",    contextWindow: 1_000_000, inputCostPer1M: PRICE(0.40), outputCostPer1M: PRICE(1.60), capabilities: ["chat", "tools", "json"] },
      { id: "o3-mini",         label: "o3-mini",         contextWindow: 200_000, inputCostPer1M: PRICE(1.10), outputCostPer1M: PRICE(4.40), capabilities: ["chat"] },
    ],
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    authHeader: "x-api-key",
    authScheme: "",
    platformEnvVar: "ANTHROPIC_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", contextWindow: 200_000, inputCostPer1M: PRICE(3.00),  outputCostPer1M: PRICE(15.00), capabilities: ["chat", "vision", "tools"] },
      { id: "claude-3-5-haiku-20241022",  label: "Claude 3.5 Haiku",  contextWindow: 200_000, inputCostPer1M: PRICE(0.80),  outputCostPer1M: PRICE(4.00),  capabilities: ["chat", "tools"] },
      { id: "claude-3-opus-20240229",     label: "Claude 3 Opus",     contextWindow: 200_000, inputCostPer1M: PRICE(15.00), outputCostPer1M: PRICE(75.00), capabilities: ["chat", "vision", "tools"] },
    ],
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    protocol: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "DEEPSEEK_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://platform.deepseek.com/api_keys",
    models: [
      { id: "deepseek-chat",     label: "DeepSeek V3 Chat",  contextWindow: 64_000, inputCostPer1M: PRICE(0.27), outputCostPer1M: PRICE(1.10), capabilities: ["chat", "tools", "json"] },
      { id: "deepseek-reasoner", label: "DeepSeek R1",       contextWindow: 64_000, inputCostPer1M: PRICE(0.55), outputCostPer1M: PRICE(2.19), capabilities: ["chat"] },
    ],
  },
  groq: {
    id: "groq",
    label: "Groq",
    protocol: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "GROQ_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://console.groq.com/keys",
    models: [
      { id: "llama-3.3-70b-versatile",      label: "Llama 3.3 70B",     contextWindow: 128_000, inputCostPer1M: PRICE(0.59), outputCostPer1M: PRICE(0.79), capabilities: ["chat", "tools", "json"] },
      { id: "llama-3.1-8b-instant",         label: "Llama 3.1 8B",      contextWindow: 128_000, inputCostPer1M: PRICE(0.05), outputCostPer1M: PRICE(0.08), capabilities: ["chat", "tools", "json"] },
      { id: "mixtral-8x7b-32768",           label: "Mixtral 8x7B",      contextWindow: 32_768,  inputCostPer1M: PRICE(0.24), outputCostPer1M: PRICE(0.24), capabilities: ["chat"] },
      { id: "deepseek-r1-distill-llama-70b",label: "DeepSeek R1 Distill (Llama 70B)", contextWindow: 128_000, inputCostPer1M: PRICE(0.75), outputCostPer1M: PRICE(0.99), capabilities: ["chat"] },
    ],
  },
  together: {
    id: "together",
    label: "Together AI",
    protocol: "openai-compatible",
    baseUrl: "https://api.together.xyz/v1",
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "TOGETHER_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://api.together.ai/settings/api-keys",
    models: [
      { id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", label: "Llama 3.1 70B Turbo", contextWindow: 128_000, inputCostPer1M: PRICE(0.88), outputCostPer1M: PRICE(0.88), capabilities: ["chat"] },
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",       label: "Llama 3.3 70B Turbo", contextWindow: 128_000, inputCostPer1M: PRICE(0.88), outputCostPer1M: PRICE(0.88), capabilities: ["chat"] },
      { id: "deepseek-ai/DeepSeek-V3",                       label: "DeepSeek V3",         contextWindow: 64_000,  inputCostPer1M: PRICE(1.25), outputCostPer1M: PRICE(1.25), capabilities: ["chat"] },
    ],
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    protocol: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "OPENROUTER_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://openrouter.ai/keys",
    models: [
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (via OpenRouter)", contextWindow: 200_000, inputCostPer1M: PRICE(3.00),  outputCostPer1M: PRICE(15.00) },
      { id: "openai/gpt-4o",               label: "GPT-4o (via OpenRouter)",            contextWindow: 128_000, inputCostPer1M: PRICE(2.50),  outputCostPer1M: PRICE(10.00) },
      { id: "deepseek/deepseek-chat",      label: "DeepSeek V3 (via OpenRouter)",       contextWindow: 64_000,  inputCostPer1M: PRICE(0.27),  outputCostPer1M: PRICE(1.10) },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B (via OpenRouter)", contextWindow: 128_000, inputCostPer1M: PRICE(0.13), outputCostPer1M: PRICE(0.40) },
    ],
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    protocol: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1",
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "MISTRAL_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://console.mistral.ai/api-keys/",
    models: [
      { id: "mistral-large-latest",  label: "Mistral Large",  contextWindow: 128_000, inputCostPer1M: PRICE(2.00), outputCostPer1M: PRICE(6.00), capabilities: ["chat", "tools", "json"] },
      { id: "mistral-small-latest",  label: "Mistral Small",  contextWindow: 32_000,  inputCostPer1M: PRICE(0.20), outputCostPer1M: PRICE(0.60), capabilities: ["chat", "tools", "json"] },
      { id: "codestral-latest",      label: "Codestral",      contextWindow: 32_000,  inputCostPer1M: PRICE(0.20), outputCostPer1M: PRICE(0.60), capabilities: ["chat"] },
    ],
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    protocol: "openai-compatible",
    baseUrl: "https://api.perplexity.ai",
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "PERPLEXITY_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://www.perplexity.ai/settings/api",
    models: [
      { id: "sonar",          label: "Sonar (online research)", contextWindow: 127_000, inputCostPer1M: PRICE(1.00),  outputCostPer1M: PRICE(1.00), capabilities: ["chat"] },
      { id: "sonar-pro",      label: "Sonar Pro",               contextWindow: 200_000, inputCostPer1M: PRICE(3.00),  outputCostPer1M: PRICE(15.00), capabilities: ["chat"] },
      { id: "sonar-reasoning",label: "Sonar Reasoning",         contextWindow: 127_000, inputCostPer1M: PRICE(1.00),  outputCostPer1M: PRICE(5.00),  capabilities: ["chat"] },
    ],
  },
  xai: {
    id: "xai",
    label: "xAI (Grok)",
    protocol: "openai-compatible",
    baseUrl: "https://api.x.ai/v1",
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "XAI_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://console.x.ai/",
    models: [
      { id: "grok-2-latest",     label: "Grok 2",      contextWindow: 131_072, inputCostPer1M: PRICE(2.00), outputCostPer1M: PRICE(10.00), capabilities: ["chat", "tools"] },
      { id: "grok-2-vision-latest", label: "Grok 2 Vision", contextWindow: 32_768, inputCostPer1M: PRICE(2.00), outputCostPer1M: PRICE(10.00), capabilities: ["chat", "vision"] },
    ],
  },
  fireworks: {
    id: "fireworks",
    label: "Fireworks AI",
    protocol: "openai-compatible",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "FIREWORKS_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://fireworks.ai/account/api-keys",
    models: [
      { id: "accounts/fireworks/models/llama-v3p3-70b-instruct", label: "Llama 3.3 70B", contextWindow: 128_000, inputCostPer1M: PRICE(0.90), outputCostPer1M: PRICE(0.90), capabilities: ["chat", "tools", "json"] },
      { id: "accounts/fireworks/models/deepseek-v3",             label: "DeepSeek V3",   contextWindow: 64_000,  inputCostPer1M: PRICE(0.90), outputCostPer1M: PRICE(0.90), capabilities: ["chat"] },
    ],
  },
  anyscale: {
    id: "anyscale",
    label: "Anyscale",
    protocol: "openai-compatible",
    baseUrl: "https://api.endpoints.anyscale.com/v1",
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "ANYSCALE_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://app.endpoints.anyscale.com/credentials",
    models: [
      { id: "meta-llama/Meta-Llama-3-70B-Instruct", label: "Llama 3 70B", contextWindow: 8_192, inputCostPer1M: PRICE(1.00), outputCostPer1M: PRICE(1.00), capabilities: ["chat"] },
    ],
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    protocol: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    authHeader: "X-API-Key", // Gemini also accepts ?key= query param; handled in client.
    authScheme: "",
    platformEnvVar: "GEMINI_API_KEY",
    requiresApiKey: true,
    signupUrl: "https://aistudio.google.com/app/apikey",
    models: [
      { id: "gemini-1.5-pro",   label: "Gemini 1.5 Pro",   contextWindow: 2_000_000, inputCostPer1M: PRICE(1.25), outputCostPer1M: PRICE(5.00), capabilities: ["chat", "vision", "tools", "json"] },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", contextWindow: 1_000_000, inputCostPer1M: PRICE(0.075),outputCostPer1M: PRICE(0.30), capabilities: ["chat", "vision", "tools", "json"] },
      { id: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash (exp)", contextWindow: 1_000_000, inputCostPer1M: PRICE(0.075), outputCostPer1M: PRICE(0.30), capabilities: ["chat", "vision", "tools", "json"] },
    ],
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local)",
    protocol: "openai-compatible",
    baseUrl: "http://localhost:11434/v1",
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "OLLAMA_API_KEY", // typically unused
    requiresApiKey: false,
    signupUrl: "https://ollama.com/download",
    models: [
      { id: "llama3.3",   label: "Llama 3.3",   contextWindow: 128_000, inputCostPer1M: 0, outputCostPer1M: 0, capabilities: ["chat"] },
      { id: "mistral",    label: "Mistral",     contextWindow: 32_000,  inputCostPer1M: 0, outputCostPer1M: 0, capabilities: ["chat"] },
      { id: "qwen2.5",    label: "Qwen 2.5",    contextWindow: 128_000, inputCostPer1M: 0, outputCostPer1M: 0, capabilities: ["chat"] },
    ],
  },
  custom: {
    id: "custom",
    label: "Custom OpenAI-compatible endpoint",
    protocol: "openai-compatible",
    baseUrl: null,
    authHeader: "Authorization",
    authScheme: "Bearer ",
    platformEnvVar: "CUSTOM_OPENAI_API_KEY",
    requiresApiKey: false, // depends on the user's endpoint
    signupUrl: "",
    models: [],
  },
};

export function getProvider(id: string): ProviderInfo {
  const p = (PROVIDERS as Record<string, ProviderInfo>)[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

/** Looks up a model from the catalog. Returns undefined for free-text/custom models. */
export function getModelInfo(providerId: string, modelId: string): ModelInfo | undefined {
  return getProvider(providerId).models.find((m) => m.id === modelId);
}

/** Compute cost in micro-cents for a (model, prompt, completion) tuple. */
export function computeCostMicroCents(
  providerId: string,
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const m = getModelInfo(providerId, modelId);
  if (!m) return 0;
  const inCost = Math.ceil((m.inputCostPer1M * promptTokens) / 1_000_000);
  const outCost = Math.ceil((m.outputCostPer1M * completionTokens) / 1_000_000);
  return inCost + outCost;
}

/** Public-safe view of providers (no env var values). */
export function publicProviderCatalog() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    requiresApiKey: p.requiresApiKey,
    signupUrl: p.signupUrl,
    platformAvailable: !!process.env[p.platformEnvVar],
    models: p.models,
  }));
}
