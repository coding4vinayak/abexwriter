/**
 * Phase 1 LLM endpoints.
 *
 *   /api/llm/providers           — list providers + which platform keys are configured
 *   /api/llm/generate            — generic generation (any feature)
 *   /api/llm/test                — test a key/connection
 *   /api/api-keys                — CRUD for BYOK keys (encrypted)
 *   /api/usage                   — token / cost dashboard
 *   /api/books/:id/bible         — story-bible CRUD
 *   /api/books/:id/steering      — steering notes CRUD
 *   /api/generate/chapter-outlines  (replaces simulated version)
 *   /api/generate/chapter-content   (replaces simulated version, story-context aware)
 *   /api/generations             — version history
 */
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { encrypt, redactKey, decrypt } from "./crypto";
import { generateChat, errorToHttpStatus, type ChatMessage } from "./client";
import { publicProviderCatalog, getProvider, type ProviderId } from "./providers";
import { assertWithinPlatformQuota, QuotaExceededError } from "./usage";
import {
  buildContextualChapterContentPrompt,
  buildContextualChapterOutlinesPrompt,
  buildRewritePrompt,
  buildStoryContextBlock,
  extractJson,
  type StoryContext,
} from "./prompts";
import {
  buildHumanizePrompt,
  cleanHumanizerOutput,
  humanizerDiffStats,
  ALL_PASSES,
  PASS_LABELS,
  type HumanizerPass,
} from "./humanize";
import {
  insertUserApiKeySchema,
  insertSteeringNoteSchema,
  insertBookBibleSchema,
  type UserApiKey,
  type UserApiKeyPublic,
} from "@shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Auth shim. Real auth is Phase 2; today every request acts as user 1 to keep
// parity with the existing routes.ts. Centralised here so the swap is one-line.
// ─────────────────────────────────────────────────────────────────────────────
function getUserId(_req: Request): number {
  return 1;
}

function publicKey(k: UserApiKey): UserApiKeyPublic {
  // strip encryptedKey
  const { encryptedKey, ...rest } = k;
  return rest;
}

const generateBodySchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  mode: z.enum(["byok", "platform"]).default("byok"),
  apiKeyId: z.number().int().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant", "tool"]),
        content: z.string(),
        name: z.string().optional(),
      }),
    )
    .min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(32_000).optional(),
  topP: z.number().min(0).max(1).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  stop: z.array(z.string()).optional(),
  jsonMode: z.boolean().optional(),
  feature: z.string().optional(),
  bookId: z.number().int().optional(),
  chapterId: z.number().int().optional(),
});

const testKeyBodySchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().optional(),
  apiKeyId: z.number().int().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().optional(),
});

const chapterOutlinesBodySchema = z.object({
  bookId: z.number().int().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  genre: z.string().min(1),
  numberOfChapters: z.number().int().min(1).max(80),
  language: z.string().optional(),
  provider: z.string().min(1),
  model: z.string().min(1),
  mode: z.enum(["byok", "platform"]).default("byok"),
  apiKeyId: z.number().int().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().optional(),
});

const chapterContentBodySchema = z.object({
  bookId: z.number().int().optional(),
  chapterId: z.number().int().optional(),
  title: z.string().min(1),
  outline: z.string().min(1),
  language: z.string().optional(),
  targetWordCount: z.number().int().min(200).max(20_000).optional(),
  provider: z.string().min(1),
  model: z.string().min(1),
  mode: z.enum(["byok", "platform"]).default("byok"),
  apiKeyId: z.number().int().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Build a StoryContext for a given book by gluing together: book row,
// book bible, active steering notes, and the previous chapter's tail.
// ─────────────────────────────────────────────────────────────────────────────
async function loadStoryContext(bookId?: number, chapterId?: number): Promise<StoryContext> {
  const ctx: StoryContext = {};
  if (!bookId) return ctx;

  const book = await storage.getBook(bookId);
  if (book) {
    ctx.bookTitle = book.title;
    ctx.premise = book.description ?? null;
  }
  const bible = await storage.getBookBible(bookId);
  if (bible) {
    ctx.premise = bible.premise ?? ctx.premise ?? null;
    ctx.setting = bible.setting ?? null;
    ctx.themes = bible.themes ?? null;
    ctx.styleGuide = bible.styleGuide ?? null;
    ctx.glossary = bible.glossary ?? null;
    ctx.rollingSummary = bible.rollingSummary ?? null;
    ctx.entities = (bible.entities ?? {}) as any;
    ctx.language = bible.language ?? null;
  }

  const notes = await storage.listSteeringNotes(bookId, { activeOnly: true });
  if (notes.length) {
    ctx.steeringNotes = notes.map((n) => ({ note: n.note, priority: n.priority }));
  }

  // For continuity, pull the tail of the immediately-preceding chapter.
  if (chapterId) {
    const cur = await storage.getChapter(chapterId);
    if (cur) {
      const all = await storage.getChapters(cur.bookId);
      const prev = all
        .filter((c) => c.orderIndex < cur.orderIndex)
        .sort((a, b) => b.orderIndex - a.orderIndex)[0];
      if (prev?.content) {
        const tail = prev.content.trim().split(/\n\n+/).slice(-2).join("\n\n");
        ctx.previousChapterEnding = tail.slice(-1500);
      }
    }
  }
  return ctx;
}

export async function registerLlmRoutes(app: Express): Promise<void> {
  // ───────────────────────────────────────────────────────────────────────
  // Provider catalog
  // ───────────────────────────────────────────────────────────────────────
  app.get("/api/llm/providers", (_req, res) => {
    res.json({ providers: publicProviderCatalog() });
  });

  // ───────────────────────────────────────────────────────────────────────
  // BYOK API keys
  // ───────────────────────────────────────────────────────────────────────
  app.get("/api/api-keys", async (req, res) => {
    try {
      const userId = getUserId(req);
      const rows = await storage.listUserApiKeys(userId);
      res.json(rows.map(publicKey));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/api-keys", async (req, res) => {
    try {
      const userId = getUserId(req);
      const parsed = insertUserApiKeySchema.parse({ ...req.body, userId });
      const provider = getProvider(parsed.provider);
      // Custom provider needs a baseUrl.
      const baseUrl = parsed.baseUrl || provider.baseUrl || null;
      if (!baseUrl) {
        return res
          .status(400)
          .json({ error: "Custom OpenAI-compatible providers require a baseUrl." });
      }
      const encryptedKey = encrypt(parsed.apiKey);
      const keyPreview = redactKey(parsed.apiKey);
      const row = await storage.createUserApiKey({
        userId,
        provider: parsed.provider,
        label: parsed.label || provider.label,
        encryptedKey,
        keyPreview,
        baseUrl: parsed.baseUrl ?? null,
        defaultModel: parsed.defaultModel ?? null,
        isActive: parsed.isActive ?? true,
      });
      res.status(201).json(publicKey(row));
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/api-keys/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = Number(req.params.id);
      const patchSchema = z.object({
        label: z.string().min(1).optional(),
        apiKey: z.string().min(1).optional(),
        baseUrl: z.string().nullable().optional(),
        defaultModel: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      });
      const patch = patchSchema.parse(req.body);
      const update: any = {};
      if (patch.label !== undefined) update.label = patch.label;
      if (patch.baseUrl !== undefined) update.baseUrl = patch.baseUrl;
      if (patch.defaultModel !== undefined) update.defaultModel = patch.defaultModel;
      if (patch.isActive !== undefined) update.isActive = patch.isActive;
      if (patch.apiKey) {
        update.encryptedKey = encrypt(patch.apiKey);
        update.keyPreview = redactKey(patch.apiKey);
      }
      const row = await storage.updateUserApiKey(id, userId, update);
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(publicKey(row));
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/api-keys/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      const ok = await storage.deleteUserApiKey(Number(req.params.id), userId);
      if (!ok) return res.status(404).json({ error: "Not found" });
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Test connection — sends a tiny "ping" prompt to verify the key works.
  // Accepts EITHER a raw apiKey (typed in but not yet saved) OR an apiKeyId.
  // ───────────────────────────────────────────────────────────────────────
  app.post("/api/llm/test", async (req, res) => {
    try {
      const userId = getUserId(req);
      const body = testKeyBodySchema.parse(req.body);
      const provider = getProvider(body.provider);
      let apiKey = body.apiKey || "";
      let baseUrl = body.baseUrl || provider.baseUrl;
      if (body.apiKeyId) {
        const row = await storage.getUserApiKey(body.apiKeyId, userId);
        if (!row) return res.status(404).json({ error: "API key not found" });
        apiKey = decrypt(row.encryptedKey);
        baseUrl = row.baseUrl || baseUrl;
      }
      if (provider.requiresApiKey && !apiKey) {
        return res.status(400).json({ error: `${provider.label} requires an API key.` });
      }
      if (!baseUrl) return res.status(400).json({ error: "Missing baseUrl for custom provider." });

      const model = body.model || provider.models[0]?.id;
      if (!model) {
        return res.status(400).json({ error: "Provide a model id (no defaults for this provider)." });
      }

      // We invoke generateChat with a literal in-line resolved key by inserting
      // an ephemeral BYOK record path: skip the resolver and call the protocol
      // clients directly. Simpler: call generateChat in BYOK mode if apiKeyId
      // is provided, otherwise we fall through to a one-shot fetch.
      if (body.apiKeyId) {
        const result = await generateChat({
          userId,
          providerId: body.provider as ProviderId,
          mode: "byok",
          apiKeyId: body.apiKeyId,
          model,
          messages: [
            { role: "user", content: "Reply with the single word: pong" },
          ],
          temperature: 0,
          maxTokens: 8,
          feature: "test",
        });
        return res.json({
          ok: true,
          model,
          provider: body.provider,
          reply: result.text.trim(),
          tokens: result.totalTokens,
          ms: result.durationMs,
        });
      }

      // No saved key — call the right protocol client directly.
      const { openAICompatChat } = await import("./openai-compat");
      const { anthropicChat } = await import("./anthropic");
      const { geminiChat } = await import("./gemini");
      let reply = "";
      const messages: ChatMessage[] = [
        { role: "user", content: "Reply with the single word: pong" },
      ];
      if (provider.protocol === "anthropic") {
        const r = await anthropicChat({ baseUrl, apiKey, model, messages, maxTokens: 8 });
        reply = r.text;
      } else if (provider.protocol === "gemini") {
        const r = await geminiChat({ baseUrl, apiKey, model, messages, maxTokens: 8 });
        reply = r.text;
      } else {
        const r = await openAICompatChat({
          providerId: body.provider as ProviderId,
          baseUrl,
          apiKey,
          model,
          messages,
          maxTokens: 8,
          temperature: 0,
        });
        reply = r.text;
      }
      res.json({ ok: true, model, provider: body.provider, reply: reply.trim() });
    } catch (err: any) {
      const { status, message } = errorToHttpStatus(err);
      res.status(status).json({ ok: false, error: message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Generic generation
  // ───────────────────────────────────────────────────────────────────────
  app.post("/api/llm/generate", async (req, res) => {
    try {
      const userId = getUserId(req);
      const body = generateBodySchema.parse(req.body);
      if (body.mode === "platform") await assertWithinPlatformQuota(userId, "platform");
      const result = await generateChat({
        userId,
        providerId: body.provider as ProviderId,
        mode: body.mode,
        apiKeyId: body.apiKeyId,
        model: body.model,
        messages: body.messages,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        topP: body.topP,
        presencePenalty: body.presencePenalty,
        frequencyPenalty: body.frequencyPenalty,
        stop: body.stop,
        jsonMode: body.jsonMode,
        feature: body.feature ?? "custom",
        bookId: body.bookId,
        chapterId: body.chapterId,
      });
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      if (err instanceof QuotaExceededError) {
        return res.status(402).json({ error: err.message, used: err.used, limit: err.limit });
      }
      const { status, message } = errorToHttpStatus(err);
      res.status(status).json({ error: message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Usage dashboard
  // ───────────────────────────────────────────────────────────────────────
  app.get("/api/usage", async (req, res) => {
    try {
      const userId = getUserId(req);
      const summary = await storage.getUsageSummary(userId);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/usage/events", async (req, res) => {
    try {
      const userId = getUserId(req);
      const limit = Math.min(Number(req.query.limit) || 50, 500);
      const events = await storage.listUsageEvents(userId, limit);
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Book bible (story context)
  // ───────────────────────────────────────────────────────────────────────
  app.get("/api/books/:id/bible", async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      const bible = await storage.getBookBible(bookId);
      res.json(bible ?? null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/books/:id/bible", async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      const parsed = insertBookBibleSchema.parse({ ...req.body, bookId });
      const row = await storage.upsertBookBible(parsed);
      res.json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Steering notes
  // ───────────────────────────────────────────────────────────────────────
  app.get("/api/books/:id/steering", async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      const activeOnly = req.query.activeOnly === "true";
      const notes = await storage.listSteeringNotes(bookId, { activeOnly });
      res.json(notes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/books/:id/steering", async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      const parsed = insertSteeringNoteSchema.parse({ ...req.body, bookId });
      const row = await storage.createSteeringNote(parsed);
      res.status(201).json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/steering/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const patch = z
        .object({
          note: z.string().optional(),
          isActive: z.boolean().optional(),
          priority: z.number().int().optional(),
          chapterId: z.number().int().nullable().optional(),
        })
        .parse(req.body);
      const row = await storage.updateSteeringNote(id, patch as any);
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/steering/:id", async (req, res) => {
    try {
      const ok = await storage.deleteSteeringNote(Number(req.params.id));
      if (!ok) return res.status(404).json({ error: "Not found" });
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Generations (version history)
  // ───────────────────────────────────────────────────────────────────────
  app.get("/api/generations", async (req, res) => {
    try {
      const userId = getUserId(req);
      const list = await storage.listGenerations({
        userId,
        bookId: req.query.bookId ? Number(req.query.bookId) : undefined,
        chapterId: req.query.chapterId ? Number(req.query.chapterId) : undefined,
        kind: req.query.kind as any,
        limit: Math.min(Number(req.query.limit) || 50, 200),
      });
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/generations/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      const row = await storage.getGeneration(Number(req.params.id), userId);
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Apply a generation: copies its output into the chapter's content + marks
  // the generation as 'applied' (and any siblings as 'discarded' optionally).
  app.post("/api/generations/:id/apply", async (req, res) => {
    try {
      const userId = getUserId(req);
      const gen = await storage.getGeneration(Number(req.params.id), userId);
      if (!gen) return res.status(404).json({ error: "Not found" });
      if (!gen.chapterId) return res.status(400).json({ error: "Generation has no chapter" });
      await storage.updateChapter(gen.chapterId, { content: gen.output });
      await storage.updateGeneration(gen.id, { status: "applied" } as any);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Story-aware chapter generation (replaces the simulated handlers)
  // ───────────────────────────────────────────────────────────────────────
  app.post("/api/generate/chapter-outlines", async (req, res) => {
    try {
      const userId = getUserId(req);
      const body = chapterOutlinesBodySchema.parse(req.body);
      if (body.mode === "platform") await assertWithinPlatformQuota(userId, "platform");

      const ctx = await loadStoryContext(body.bookId);
      const messages = buildContextualChapterOutlinesPrompt(
        {
          title: body.title,
          description: body.description,
          genre: body.genre,
          numberOfChapters: body.numberOfChapters,
          language: body.language,
        },
        ctx,
      );

      const result = await generateChat({
        userId,
        providerId: body.provider as ProviderId,
        mode: body.mode,
        apiKeyId: body.apiKeyId,
        model: body.model,
        messages,
        temperature: body.temperature ?? 0.7,
        maxTokens: body.maxTokens ?? 4000,
        jsonMode: true,
        feature: "chapter_outline",
        bookId: body.bookId,
      });

      const parsed = extractJson<{ outlines: any[] }>(result.text);
      const outlines = parsed?.outlines ?? null;

      const generation = await storage.createGeneration({
        userId,
        bookId: body.bookId ?? null,
        chapterId: null,
        kind: "chapter_outline",
        status: outlines ? "completed" : "failed",
        provider: body.provider as any,
        model: body.model,
        mode: body.mode,
        prompt: messages as any,
        output: result.text,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        costMicroCents: result.costMicroCents,
        durationMs: result.durationMs,
        errorMessage: outlines ? null : "Could not parse JSON from model output",
        metadata: {
          numberOfChapters: body.numberOfChapters,
          language: body.language ?? "English",
        } as any,
      });

      res.json({ outlines, raw: result.text, generationId: generation.id, usage: result });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      if (err instanceof QuotaExceededError) {
        return res.status(402).json({ error: err.message, used: err.used, limit: err.limit });
      }
      const { status, message } = errorToHttpStatus(err);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/generate/chapter-content", async (req, res) => {
    try {
      const userId = getUserId(req);
      const body = chapterContentBodySchema.parse(req.body);
      if (body.mode === "platform") await assertWithinPlatformQuota(userId, "platform");

      const ctx = await loadStoryContext(body.bookId, body.chapterId);
      const book = body.bookId ? await storage.getBook(body.bookId) : undefined;

      const messages = buildContextualChapterContentPrompt(
        {
          title: body.title,
          outline: body.outline,
          bookTitle: book?.title,
          bookDescription: book?.description ?? undefined,
          language: body.language,
          targetWordCount: body.targetWordCount,
          previousChapterEnding: ctx.previousChapterEnding ?? undefined,
        },
        ctx,
      );

      const result = await generateChat({
        userId,
        providerId: body.provider as ProviderId,
        mode: body.mode,
        apiKeyId: body.apiKeyId,
        model: body.model,
        messages,
        temperature: body.temperature ?? 0.8,
        maxTokens: body.maxTokens ?? 8000,
        feature: "chapter_content",
        bookId: body.bookId,
        chapterId: body.chapterId,
      });

      const generation = await storage.createGeneration({
        userId,
        bookId: body.bookId ?? null,
        chapterId: body.chapterId ?? null,
        kind: "chapter_content",
        status: "completed",
        provider: body.provider as any,
        model: body.model,
        mode: body.mode,
        prompt: messages as any,
        output: result.text,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        costMicroCents: result.costMicroCents,
        durationMs: result.durationMs,
        metadata: {
          targetWordCount: body.targetWordCount ?? 2500,
          language: body.language ?? ctx.language ?? "English",
        } as any,
      });

      res.json({ content: result.text, generationId: generation.id, usage: result });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      if (err instanceof QuotaExceededError) {
        return res.status(402).json({ error: err.message, used: err.used, limit: err.limit });
      }
      const { status, message } = errorToHttpStatus(err);
      res.status(status).json({ error: message });
    }
  });

  // Rewrite/expand/shrink/describe — single endpoint, "instruction" determines behaviour.
  app.post("/api/generate/rewrite", async (req, res) => {
    try {
      const userId = getUserId(req);
      const body = z
        .object({
          text: z.string().min(1),
          instruction: z.string().min(1),
          provider: z.string().min(1),
          model: z.string().min(1),
          mode: z.enum(["byok", "platform"]).default("byok"),
          apiKeyId: z.number().int().optional(),
          bookId: z.number().int().optional(),
          chapterId: z.number().int().optional(),
          language: z.string().optional(),
          temperature: z.number().min(0).max(2).optional(),
        })
        .parse(req.body);
      if (body.mode === "platform") await assertWithinPlatformQuota(userId, "platform");

      const ctx = body.bookId ? await loadStoryContext(body.bookId, body.chapterId) : ({} as StoryContext);
      const messages = buildRewritePrompt({
        text: body.text,
        instruction: body.instruction,
        styleGuide: ctx.styleGuide ?? undefined,
        language: body.language ?? ctx.language ?? "English",
      });
      // Append a story-context system message so character voice etc. are preserved.
      const ctxBlock = buildStoryContextBlock(ctx);
      if (ctxBlock) messages.splice(1, 0, { role: "system", content: ctxBlock });

      const result = await generateChat({
        userId,
        providerId: body.provider as ProviderId,
        mode: body.mode,
        apiKeyId: body.apiKeyId,
        model: body.model,
        messages,
        temperature: body.temperature ?? 0.7,
        maxTokens: 4000,
        feature: "rewrite",
        bookId: body.bookId,
        chapterId: body.chapterId,
      });

      const generation = await storage.createGeneration({
        userId,
        bookId: body.bookId ?? null,
        chapterId: body.chapterId ?? null,
        kind: "rewrite",
        status: "completed",
        provider: body.provider as any,
        model: body.model,
        mode: body.mode,
        prompt: messages as any,
        output: result.text,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        costMicroCents: result.costMicroCents,
        durationMs: result.durationMs,
        metadata: { instruction: body.instruction } as any,
      });

      res.json({ text: result.text, generationId: generation.id, usage: result });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      if (err instanceof QuotaExceededError) {
        return res.status(402).json({ error: err.message, used: err.used, limit: err.limit });
      }
      const { status, message } = errorToHttpStatus(err);
      res.status(status).json({ error: message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Humanizer — anti-AI-slop rewrite with intensity meter
  // ───────────────────────────────────────────────────────────────────────
  app.get("/api/humanize/options", (_req, res) => {
    res.json({
      passes: ALL_PASSES.map((id) => ({ id, ...PASS_LABELS[id] })),
    });
  });

  app.post("/api/humanize", async (req, res) => {
    try {
      const userId = getUserId(req);
      const body = z
        .object({
          text: z.string().min(20, "Need at least 20 characters of prose to humanize"),
          intensity: z.number().min(0).max(100).default(50),
          passes: z.array(z.string()).default([...ALL_PASSES]),
          provider: z.string().min(1),
          model: z.string().min(1),
          mode: z.enum(["byok", "platform"]).default("byok"),
          apiKeyId: z.number().int().optional(),
          bookId: z.number().int().optional(),
          chapterId: z.number().int().optional(),
          language: z.string().optional(),
          customNote: z.string().optional(),
          temperature: z.number().min(0).max(2).optional(),
        })
        .parse(req.body);

      // Validate pass IDs.
      const validPasses = body.passes.filter((p): p is HumanizerPass =>
        (ALL_PASSES as string[]).includes(p),
      );
      if (validPasses.length === 0) {
        return res.status(400).json({ error: "Pick at least one humanization pass." });
      }

      if (body.mode === "platform") await assertWithinPlatformQuota(userId, "platform");

      const ctx = body.bookId ? await loadStoryContext(body.bookId, body.chapterId) : undefined;
      const messages = buildHumanizePrompt({
        text: body.text,
        intensity: body.intensity,
        passes: validPasses,
        language: body.language,
        storyContext: ctx,
        customNote: body.customNote,
      });

      // Intensity also nudges sampling temperature so "light touch" stays
      // conservative and "full revoicing" can take more risks.
      const temperature =
        body.temperature ?? Math.min(0.9, 0.4 + (body.intensity / 100) * 0.4);

      const result = await generateChat({
        userId,
        providerId: body.provider as ProviderId,
        mode: body.mode,
        apiKeyId: body.apiKeyId,
        model: body.model,
        messages,
        temperature,
        // Allow output to be longer than input by ~20% in case the model
        // adds sensory beats; cap at 16k for cost safety.
        maxTokens: Math.min(16_000, Math.max(2000, Math.round((body.text.length / 3) * 1.4))),
        feature: "humanize",
        bookId: body.bookId,
        chapterId: body.chapterId,
      });

      const cleaned = cleanHumanizerOutput(result.text);
      const stats = humanizerDiffStats(body.text, cleaned);

      const generation = await storage.createGeneration({
        userId,
        bookId: body.bookId ?? null,
        chapterId: body.chapterId ?? null,
        kind: "rewrite",
        status: "completed",
        provider: body.provider as any,
        model: body.model,
        mode: body.mode,
        prompt: messages as any,
        output: cleaned,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        costMicroCents: result.costMicroCents,
        durationMs: result.durationMs,
        metadata: {
          humanizer: true,
          intensity: body.intensity,
          passes: validPasses,
          stats,
        } as any,
      });

      res.json({
        text: cleaned,
        generationId: generation.id,
        stats,
        usage: result,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      if (err instanceof QuotaExceededError) {
        return res.status(402).json({ error: err.message, used: err.used, limit: err.limit });
      }
      const { status, message } = errorToHttpStatus(err);
      res.status(status).json({ error: message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // AI Image Generation
  // ───────────────────────────────────────────────────────────────────────
  const { generateImage, publicImageProviderCatalog } = await import("./images");

  app.get("/api/images/providers", (_req, res) => {
    res.json({ providers: publicImageProviderCatalog() });
  });

  app.post("/api/images/generate", async (req, res) => {
    try {
      const userId = getUserId(req);
      const body = z
        .object({
          provider: z.string().min(1),
          model: z.string().min(1),
          prompt: z.string().min(1),
          negativePrompt: z.string().optional(),
          size: z.string().optional(),
          style: z.enum(["vivid", "natural"]).optional(),
          quality: z.enum(["standard", "hd"]).optional(),
          apiKeyId: z.number().int().optional(),
          bookId: z.number().int(),
          chapterId: z.number().int(),
          caption: z.string().optional(),
          baseUrl: z.string().optional(),
        })
        .parse(req.body);

      // Resolve API key
      let apiKey = "";
      if (body.apiKeyId) {
        const keyRow = await storage.getUserApiKey(body.apiKeyId, userId);
        if (!keyRow) return res.status(404).json({ error: "API key not found" });
        apiKey = decrypt(keyRow.encryptedKey);
      } else {
        // Try platform env var
        const { IMAGE_PROVIDERS } = await import("./images");
        const providerInfo = (IMAGE_PROVIDERS as any)[body.provider];
        if (providerInfo?.envVar) {
          apiKey = process.env[providerInfo.envVar] || "";
        }
      }
      if (!apiKey) {
        return res.status(400).json({ error: "No API key available for this image provider." });
      }

      const result = await generateImage({
        provider: body.provider as any,
        apiKey,
        baseUrl: body.baseUrl,
        model: body.model,
        prompt: body.prompt,
        negativePrompt: body.negativePrompt,
        size: body.size,
        style: body.style,
        quality: body.quality,
      });

      // Save to chapter_images
      const { chapterImages } = await import("@shared/schema");
      const { db } = await import("../db");
      const [saved] = await db
        .insert(chapterImages)
        .values({
          chapterId: body.chapterId,
          bookId: body.bookId,
          userId,
          imageUrl: result.url,
          prompt: body.prompt,
          revisedPrompt: result.revisedPrompt ?? null,
          provider: body.provider,
          model: body.model,
          size: body.size ?? "1024x1024",
          style: body.style ?? null,
          durationMs: result.durationMs,
          caption: body.caption ?? null,
          orderIndex: 0,
        })
        .returning();

      res.json({ image: saved, durationMs: result.durationMs });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: err.message ?? "Image generation failed" });
    }
  });

  app.get("/api/chapters/:chapterId/images", async (req, res) => {
    try {
      const chapterId = Number(req.params.chapterId);
      const { chapterImages } = await import("@shared/schema");
      const { db } = await import("../db");
      const { eq, asc } = await import("drizzle-orm");
      const images = await db
        .select()
        .from(chapterImages)
        .where(eq(chapterImages.chapterId, chapterId))
        .orderBy(asc(chapterImages.orderIndex));
      res.json(images);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/images/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { chapterImages } = await import("@shared/schema");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      await db.delete(chapterImages).where(eq(chapterImages.id, id));
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Streaming SSE endpoint for chapter content generation
  // TODO: SSE streaming in future PR — will stream tokens as they arrive
  // from the LLM provider, enabling real-time typing display in the editor.
  // For now, the frontend shows a Loader2 spinner during generation.
  // ───────────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), version: "1.0.0" });
  });
}
