/**
 * Prompt builders for novel-writing features.
 *
 * Each builder returns a `messages: ChatMessage[]` array that can be passed
 * directly to `generateChat()`. System prompts emphasise human voice and
 * varied sentence structure to fight "AI-slop" output.
 */
import type { ChatMessage } from "./openai-compat";

const ANTI_SLOP_SYSTEM = `You are a novelist with a distinctive human voice.

CRITICAL — Avoid AI-slop tells:
- Do NOT open with "In the realm of…", "Picture this…", "Let me paint a picture…", "Indeed,", "Moreover,".
- Do NOT use "delve", "tapestry", "navigate", "underscore", "in conclusion", "it's important to note".
- Vary sentence length aggressively: mix 4-word sentences with 30-word ones. No three consecutive sentences of similar length.
- Use specific concrete sensory detail, never abstractions stacked on abstractions.
- Use contractions naturally. Use sentence fragments occasionally.
- Show, don't tell. Trust the reader. Resist the urge to explain emotions; render them in action and physical sensation.
- Em-dashes are fine but no more than two per page.
- Dialogue should sound like real speech — interrupt itself, trail off, leave things unsaid.
- Write in the requested language with native idiom; do not translate literally from English.`;

export interface ChapterOutlinesPrompt {
  title: string;
  description: string;
  genre: string;
  numberOfChapters: number;
  language?: string;
  styleGuide?: string;
}

export function buildChapterOutlinesPrompt(p: ChapterOutlinesPrompt): ChatMessage[] {
  const language = p.language || "English";
  const styleGuide = p.styleGuide
    ? `\n\nAuthor style notes:\n${p.styleGuide}`
    : "";
  return [
    {
      role: "system",
      content:
        `${ANTI_SLOP_SYSTEM}\n\n` +
        `You are an experienced novelist and developmental editor. ` +
        `When asked for chapter outlines, you produce a coherent narrative arc — setup, rising action, ` +
        `mid-point reversal, dark night of the soul, climax, resolution — appropriate to the genre.\n` +
        `Respond in ${language}.`,
    },
    {
      role: "user",
      content:
        `Create ${p.numberOfChapters} chapter outlines for a ${p.genre} novel titled "${p.title}".\n\n` +
        `Premise:\n${p.description}${styleGuide}\n\n` +
        `Output STRICT JSON only — no prose before or after — matching this schema:\n` +
        `{\n` +
        `  "outlines": [\n` +
        `    { "number": 1, "title": "...", "summary": "...", "beats": ["...","...","..."] }\n` +
        `  ]\n` +
        `}\n` +
        `Each summary should be 3–5 sentences and set up the next chapter. ` +
        `Each "beats" array contains 3–6 concrete scene-level beats (not abstract themes). ` +
        `The arc must build coherently across all ${p.numberOfChapters} chapters.`,
    },
  ];
}

export interface ChapterContentPrompt {
  title: string;
  outline: string;
  bookTitle?: string;
  bookDescription?: string;
  genre?: string;
  language?: string;
  styleGuide?: string;
  previousChapterEnding?: string;
  /** Approximate target word count for the chapter. */
  targetWordCount?: number;
}

export function buildChapterContentPrompt(p: ChapterContentPrompt): ChatMessage[] {
  const language = p.language || "English";
  const target = p.targetWordCount ?? 2500;
  const context =
    [
      p.bookTitle && `Book title: "${p.bookTitle}"`,
      p.genre && `Genre: ${p.genre}`,
      p.bookDescription && `Premise: ${p.bookDescription}`,
      p.styleGuide && `Style guide: ${p.styleGuide}`,
      p.previousChapterEnding && `Previous chapter ended with:\n${p.previousChapterEnding}`,
    ]
      .filter(Boolean)
      .join("\n");

  return [
    {
      role: "system",
      content:
        `${ANTI_SLOP_SYSTEM}\n\n` +
        `You are writing a full publication-ready chapter of a novel. Aim for roughly ${target} words. ` +
        `Use scene breaks (a centred "***" on its own line) where appropriate. ` +
        `Open in scene — drop the reader into action, sensation, or dialogue. ` +
        `Do not summarise the outline; dramatise it. ` +
        `Respond in ${language}.`,
    },
    {
      role: "user",
      content:
        (context ? `${context}\n\n` : "") +
        `Chapter title: ${p.title}\n\n` +
        `Outline / beats:\n${p.outline}\n\n` +
        `Write the full chapter now. Plain prose only — no headings, no markdown, no commentary.`,
    },
  ];
}

export interface RewritePrompt {
  text: string;
  instruction: string;
  styleGuide?: string;
  language?: string;
}

export function buildRewritePrompt(p: RewritePrompt): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        `${ANTI_SLOP_SYSTEM}\n\n` +
        `You revise prose at the line level. Preserve plot, character intent, and viewpoint. ` +
        `Return ONLY the rewritten passage — no preamble, no explanation, no markdown fences. ` +
        `Respond in ${p.language || "English"}.`,
    },
    {
      role: "user",
      content:
        (p.styleGuide ? `Author style guide:\n${p.styleGuide}\n\n` : "") +
        `Instruction: ${p.instruction}\n\nPassage:\n${p.text}`,
    },
  ];
}

/**
 * Best-effort JSON extraction. LLMs occasionally wrap JSON in ``` fences or add
 * a sentence of preamble despite "JSON only" instructions.
 */
export function extractJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : raw;
  // Find the first balanced JSON object/array.
  const start = candidate.search(/[{[]/);
  if (start === -1) return null;
  for (let end = candidate.length; end > start; end--) {
    const slice = candidate.slice(start, end);
    if (/[}\]]$/.test(slice)) {
      try {
        return JSON.parse(slice) as T;
      } catch {
        /* keep shrinking */
      }
    }
  }
  return null;
}



// ─────────────────────────────────────────────────────────────────────────────
// Story-bible-aware context composition.
//
// Long-form fiction needs continuity. Before each generation we assemble a
// "story context block" from the book bible (premise, setting, themes,
// characters, world rules), active steering notes (author directives), and
// the rolling summary or previous chapter ending. This block is injected as
// a SECOND system message — separate from the persona/style system message —
// so providers that respect role boundaries (Anthropic, Gemini) keep them
// distinct, and providers that flatten them get an explicit "STORY CONTEXT"
// header to anchor on.
// ─────────────────────────────────────────────────────────────────────────────

export interface StoryEntities {
  characters?: Array<{
    name: string;
    role?: string;
    description?: string;
    arc?: string;
    voice?: string;
    relationships?: Array<{ to: string; type: string }>;
  }>;
  locations?: Array<{ name: string; description?: string }>;
  plotThreads?: Array<{ name: string; status?: string; description?: string }>;
  factions?: Array<{ name: string; description?: string }>;
  rules?: string[];
}

export interface StoryContext {
  bookTitle?: string | null;
  genre?: string | null;
  language?: string | null;
  premise?: string | null;
  setting?: string | null;
  themes?: string | null;
  styleGuide?: string | null;
  glossary?: string | null;
  rollingSummary?: string | null;
  entities?: StoryEntities | null;
  /** Active author directives, highest priority first. */
  steeringNotes?: Array<{ note: string; priority?: number }> | null;
  /** Final 1–3 paragraphs of the previous chapter for continuity. */
  previousChapterEnding?: string | null;
}

function bullet(items: string[] | undefined, max = 12): string {
  if (!items || !items.length) return "";
  return items.slice(0, max).map((s) => `  - ${s}`).join("\n");
}

export function buildStoryContextBlock(ctx: StoryContext): string {
  const parts: string[] = [];

  if (ctx.bookTitle || ctx.genre || ctx.language) {
    const meta = [
      ctx.bookTitle && `Title: "${ctx.bookTitle}"`,
      ctx.genre && `Genre: ${ctx.genre}`,
      ctx.language && `Language: ${ctx.language}`,
    ]
      .filter(Boolean)
      .join(" · ");
    parts.push(meta);
  }
  if (ctx.premise) parts.push(`PREMISE\n${ctx.premise.trim()}`);
  if (ctx.setting) parts.push(`SETTING\n${ctx.setting.trim()}`);
  if (ctx.themes) parts.push(`THEMES\n${ctx.themes.trim()}`);
  if (ctx.styleGuide) parts.push(`STYLE GUIDE\n${ctx.styleGuide.trim()}`);
  if (ctx.glossary) parts.push(`GLOSSARY\n${ctx.glossary.trim()}`);

  const e = ctx.entities;
  if (e) {
    if (e.characters && e.characters.length) {
      const lines = e.characters.slice(0, 20).map((c) => {
        const bits = [c.role && `(${c.role})`, c.description, c.voice && `voice: ${c.voice}`, c.arc && `arc: ${c.arc}`]
          .filter(Boolean)
          .join(" — ");
        const rels =
          c.relationships && c.relationships.length
            ? ` [${c.relationships.map((r) => `${r.type} ${r.to}`).join(", ")}]`
            : "";
        return `  - ${c.name}: ${bits}${rels}`;
      });
      parts.push(`CHARACTERS\n${lines.join("\n")}`);
    }
    if (e.locations && e.locations.length) {
      parts.push(
        `LOCATIONS\n${e.locations
          .slice(0, 15)
          .map((l) => `  - ${l.name}${l.description ? `: ${l.description}` : ""}`)
          .join("\n")}`,
      );
    }
    if (e.plotThreads && e.plotThreads.length) {
      parts.push(
        `PLOT THREADS\n${e.plotThreads
          .slice(0, 15)
          .map((t) => `  - ${t.name} [${t.status ?? "open"}]${t.description ? `: ${t.description}` : ""}`)
          .join("\n")}`,
      );
    }
    if (e.factions && e.factions.length) {
      parts.push(
        `FACTIONS\n${e.factions
          .slice(0, 10)
          .map((f) => `  - ${f.name}${f.description ? `: ${f.description}` : ""}`)
          .join("\n")}`,
      );
    }
    if (e.rules && e.rules.length) parts.push(`WORLD RULES\n${bullet(e.rules)}`);
  }

  if (ctx.rollingSummary) parts.push(`STORY SO FAR\n${ctx.rollingSummary.trim()}`);
  if (ctx.previousChapterEnding) {
    parts.push(`PREVIOUS CHAPTER ENDING\n${ctx.previousChapterEnding.trim()}`);
  }

  if (ctx.steeringNotes && ctx.steeringNotes.length) {
    const sorted = [...ctx.steeringNotes].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    parts.push(
      `AUTHOR DIRECTIVES (must be obeyed)\n${sorted
        .slice(0, 15)
        .map((n) => `  - ${n.note}`)
        .join("\n")}`,
    );
  }

  return parts.length ? `STORY CONTEXT\n\n${parts.join("\n\n")}` : "";
}

/**
 * Compose the full message array for a chapter content generation that is
 * aware of the entire book context.
 */
export function buildContextualChapterContentPrompt(
  basic: ChapterContentPrompt,
  context: StoryContext,
): ChatMessage[] {
  const baseMessages = buildChapterContentPrompt(basic);
  const ctxBlock = buildStoryContextBlock(context);
  if (!ctxBlock) return baseMessages;
  return [
    baseMessages[0], // anti-slop persona
    { role: "system", content: ctxBlock },
    ...baseMessages.slice(1),
  ];
}

/**
 * Same idea for chapter outlines.
 */
export function buildContextualChapterOutlinesPrompt(
  basic: ChapterOutlinesPrompt,
  context: StoryContext,
): ChatMessage[] {
  const baseMessages = buildChapterOutlinesPrompt(basic);
  const ctxBlock = buildStoryContextBlock(context);
  if (!ctxBlock) return baseMessages;
  return [baseMessages[0], { role: "system", content: ctxBlock }, ...baseMessages.slice(1)];
}
