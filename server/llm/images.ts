/**
 * AI Image Generation — multi-provider abstraction.
 *
 * Supported providers:
 *   - OpenAI DALL-E 3 (via /v1/images/generations)
 *   - Stability AI (via stability.ai REST API)
 *   - Replicate (via replicate.com predictions API)
 *   - Custom (any OpenAI-compatible image endpoint)
 *
 * All providers return a URL or base64 data URI. We store URLs in the DB
 * (chapter_images table) and let the frontend render them directly.
 */

export type ImageProviderId = "openai" | "stability" | "replicate" | "custom";

export interface ImageProviderInfo {
  id: ImageProviderId;
  label: string;
  baseUrl: string;
  envVar: string;
  models: { id: string; label: string; sizes: string[] }[];
  signupUrl: string;
}

export const IMAGE_PROVIDERS: Record<ImageProviderId, ImageProviderInfo> = {
  openai: {
    id: "openai",
    label: "OpenAI DALL-E",
    baseUrl: "https://api.openai.com/v1",
    envVar: "OPENAI_API_KEY",
    models: [
      { id: "dall-e-3", label: "DALL-E 3", sizes: ["1024x1024", "1792x1024", "1024x1792"] },
      { id: "dall-e-2", label: "DALL-E 2", sizes: ["256x256", "512x512", "1024x1024"] },
    ],
    signupUrl: "https://platform.openai.com/api-keys",
  },
  stability: {
    id: "stability",
    label: "Stability AI",
    baseUrl: "https://api.stability.ai/v2beta",
    envVar: "STABILITY_API_KEY",
    models: [
      { id: "stable-diffusion-xl-1024-v1-0", label: "SDXL 1.0", sizes: ["1024x1024"] },
      { id: "stable-image-core", label: "Stable Image Core", sizes: ["1024x1024", "1536x1024"] },
    ],
    signupUrl: "https://platform.stability.ai/account/keys",
  },
  replicate: {
    id: "replicate",
    label: "Replicate",
    baseUrl: "https://api.replicate.com/v1",
    envVar: "REPLICATE_API_TOKEN",
    models: [
      { id: "black-forest-labs/flux-1.1-pro", label: "FLUX 1.1 Pro", sizes: ["1024x1024", "1024x768"] },
      { id: "stability-ai/sdxl", label: "SDXL via Replicate", sizes: ["1024x1024"] },
    ],
    signupUrl: "https://replicate.com/account/api-tokens",
  },
  custom: {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    envVar: "CUSTOM_IMAGE_API_KEY",
    models: [],
    signupUrl: "",
  },
};

export interface GenerateImageParams {
  provider: ImageProviderId;
  apiKey: string;
  baseUrl?: string;
  model: string;
  prompt: string;
  negativePrompt?: string;
  size?: string;
  style?: "vivid" | "natural";
  quality?: "standard" | "hd";
  n?: number;
}

export interface GenerateImageResult {
  url: string;
  revisedPrompt?: string;
  provider: ImageProviderId;
  model: string;
  durationMs: number;
}

/**
 * Generate an image via OpenAI-compatible /v1/images/generations endpoint.
 * Works for OpenAI DALL-E and any proxy that speaks the same protocol.
 */
async function generateOpenAI(params: GenerateImageParams): Promise<GenerateImageResult> {
  const start = Date.now();
  const url = `${(params.baseUrl || IMAGE_PROVIDERS.openai.baseUrl).replace(/\/$/, "")}/images/generations`;

  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: params.n ?? 1,
    size: params.size ?? "1024x1024",
    response_format: "url",
  };
  if (params.style) body.style = params.style;
  if (params.quality) body.quality = params.quality;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from image API: ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(parsed?.error?.message || `Image generation failed: ${res.status}`);
  }

  const imageUrl = parsed?.data?.[0]?.url || parsed?.data?.[0]?.b64_json;
  if (!imageUrl) throw new Error("No image URL in response");

  return {
    url: imageUrl.startsWith("data:") || imageUrl.startsWith("http") ? imageUrl : `data:image/png;base64,${imageUrl}`,
    revisedPrompt: parsed?.data?.[0]?.revised_prompt,
    provider: params.provider,
    model: params.model,
    durationMs: Date.now() - start,
  };
}

/**
 * Generate via Stability AI REST API.
 */
async function generateStability(params: GenerateImageParams): Promise<GenerateImageResult> {
  const start = Date.now();
  const baseUrl = params.baseUrl || IMAGE_PROVIDERS.stability.baseUrl;
  const url = `${baseUrl}/stable-image/generate/core`;

  const formData = new FormData();
  formData.append("prompt", params.prompt);
  if (params.negativePrompt) formData.append("negative_prompt", params.negativePrompt);
  formData.append("output_format", "png");
  if (params.size) {
    const [w, h] = params.size.split("x").map(Number);
    if (w && h) {
      formData.append("aspect_ratio", w === h ? "1:1" : w > h ? "16:9" : "9:16");
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      Accept: "application/json",
    },
    body: formData as any,
  });

  const text = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Stability AI non-JSON response: ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(parsed?.message || parsed?.name || `Stability AI error: ${res.status}`);
  }

  const b64 = parsed?.image || parsed?.artifacts?.[0]?.base64;
  if (!b64) throw new Error("No image data in Stability response");

  return {
    url: `data:image/png;base64,${b64}`,
    provider: "stability",
    model: params.model,
    durationMs: Date.now() - start,
  };
}

/**
 * Generate via Replicate predictions API (synchronous mode).
 */
async function generateReplicate(params: GenerateImageParams): Promise<GenerateImageResult> {
  const start = Date.now();
  const baseUrl = params.baseUrl || IMAGE_PROVIDERS.replicate.baseUrl;

  // Create prediction
  const createRes = await fetch(`${baseUrl}/predictions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
      Prefer: "wait", // Synchronous mode
    },
    body: JSON.stringify({
      model: params.model,
      input: {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || undefined,
        width: params.size ? Number(params.size.split("x")[0]) : 1024,
        height: params.size ? Number(params.size.split("x")[1]) : 1024,
      },
    }),
  });

  const text = await createRes.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Replicate non-JSON response: ${text.slice(0, 300)}`);
  }
  if (!createRes.ok) {
    throw new Error(parsed?.detail || parsed?.title || `Replicate error: ${createRes.status}`);
  }

  // The output is either a URL string or an array of URLs
  const output = parsed?.output;
  const imageUrl = Array.isArray(output) ? output[0] : output;
  if (!imageUrl) throw new Error("No image output from Replicate");

  return {
    url: imageUrl,
    provider: "replicate",
    model: params.model,
    durationMs: Date.now() - start,
  };
}

/**
 * Unified image generation dispatcher.
 */
export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  switch (params.provider) {
    case "openai":
    case "custom":
      return generateOpenAI(params);
    case "stability":
      return generateStability(params);
    case "replicate":
      return generateReplicate(params);
    default:
      throw new Error(`Unknown image provider: ${params.provider}`);
  }
}

/** Public catalog for the frontend (no env var values exposed). */
export function publicImageProviderCatalog() {
  return Object.values(IMAGE_PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    signupUrl: p.signupUrl,
    platformAvailable: !!process.env[p.envVar],
    models: p.models,
  }));
}
