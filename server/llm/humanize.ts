/**
 * Humanizer — turns AI-slop prose into human-feeling prose.
 *
 * The user controls two things:
 *   1. **intensity** (0–100): how aggressively to rewrite. We translate this
 *      into an explicit "modify roughly X% of sentences, preserve Y% verbatim"
 *      instruction the model can follow predictably.
 *   2. **passes** (subset of HumanizerPass[]): which classes of fix to apply.
 *      Each pass is a self-contained rule; we compose them into a single
 *      checklist so we only call the LLM once.
 *
 * The output of `humanize()` is a normal Generation with kind="rewrite" so it
 * shows up in the version-history drawer and can be applied/discarded like
 * any other AI generation.
 */
import type { ChatMessage } from "./openai-compat";
import type { StoryContext } from "./prompts";
import { buildStoryContextBlock } from "./prompts";

export type HumanizerPass =
  | "decliche"      // ban delve / tapestry / navigate / "in the realm of" etc.
  | "burstiness"    // vary sentence length aggressively
  | "sensory"       // add concrete sensory specifics
  | "antirep"       // remove repeated words/phrases/structures
  | "dialogue"      // make dialogue sound spoken
  | "showdonttell"  // render emotion in action/sensation
  | "emdash";       // cap em-dashes

export const ALL_PASSES: HumanizerPass[] = [
  "decliche",
  "burstiness",
  "sensory",
  "antirep",
  "dialogue",
  "showdonttell",
  "emdash",
];

export const PASS_LABELS: Record<HumanizerPass, { label: string; blurb: string }> = {
  decliche: {
    label: "De-cliché",
    blurb:
      "Strip AI tells: delve, tapestry, navigate, underscore, in the realm of, indeed/moreover openings, 'it's important to note'.",
  },
  burstiness: {
    label: "Vary sentence length",
    blurb:
      "Mix 4-word sentences with 30-word ones. No three consecutive sentences of similar length.",
  },
  sensory: {
    label: "Sensory specifics",
    blurb:
      "Replace abstractions with concrete sight, sound, smell, touch, taste. One specific noun beats five adjectives.",
  },
  antirep: {
    label: "Anti-repetition",
    blurb:
      "Find repeated words within 200 words and vary them. Find repeated sentence structures and break the rhythm.",
  },
  dialogue: {
    label: "Dialogue polish",
    blurb:
      "Make speech sound spoken. Use contractions. Let people interrupt themselves. Replace flat 'said + adverb' with action beats.",
  },
  showdonttell: {
    label: "Show, don't tell",
    blurb:
      "Convert 'she felt X' into action and physical sensation. Trust the reader to read between the lines.",
  },
  emdash: {
    label: "Em-dash diet",
    blurb: "Cap em-dashes at two per page; replace the rest with periods or commas.",
  },
};

/** Intensity profile — derived from the 0-100 slider. */
export interface IntensityProfile {
  intensity: number;          // 0–100
  modifyPercent: number;      // % of sentences to rewrite
  preservePercent: number;    // % of original phrasing to keep
  rewriteRule: string;        // human-readable rule for the system prompt
}

export function profileFromIntensity(intensity: number): IntensityProfile {
  const i = Math.max(0, Math.min(100, Math.round(intensity)));
  let modifyPercent: number;
  let rewriteRule: string;
  if (i <= 30) {
    modifyPercent = Math.round(10 + (i / 30) * 20); // 10–30%
    rewriteRule =
      "LIGHT TOUCH: only fix the obvious AI tells listed below. Preserve the original sentence structure and word choice everywhere else. Do not invent new content. Do not change meaning.";
  } else if (i <= 60) {
    modifyPercent = Math.round(30 + ((i - 30) / 30) * 25); // 30–55%
    rewriteRule =
      "MEDIUM PASS: rewrite clichéd phrasings and stiff transitions, add a few concrete sensory beats. You may break or merge sentences for rhythm. Keep all plot beats and character actions identical.";
  } else if (i <= 90) {
    modifyPercent = Math.round(55 + ((i - 60) / 30) * 30); // 55–85%
    rewriteRule =
      "HEAVY PASS: aggressively restructure prose for voice and burstiness. Add sensory specificity. Inject sentence fragments. You may rephrase dialogue tags and beats. Plot points and dialogue meaning must remain intact.";
  } else {
    modifyPercent = Math.round(85 + ((i - 90) / 10) * 10); // 85–95%
    rewriteRule =
      "FULL REVOICING: rewrite top to bottom in a distinctive human voice. You may collapse, split, or reorder sentences as long as the SAME plot events and dialogue happen in the SAME order with the SAME outcomes. Names, places, and direct quotes must remain intact.";
  }
  return {
    intensity: i,
    modifyPercent,
    preservePercent: 100 - modifyPercent,
    rewriteRule,
  };
}

export interface HumanizerInput {
  text: string;
  passes: HumanizerPass[];
  intensity: number;       // 0-100
  language?: string;
  /** Optional story context to keep voice/character consistency. */
  storyContext?: StoryContext;
  /** Optional extra instruction for this specific call. */
  customNote?: string;
}

const PASS_RULES: Record<HumanizerPass, string> = {
  decliche: `BAN these AI tells outright (replace, don't keep):
  - "delve", "tapestry", "navigate" (as metaphor), "underscore", "elucidate"
  - "in the realm of", "in conclusion", "it's important to note", "it goes without saying"
  - "moreover", "furthermore", "indeed" as sentence openers
  - "a testament to", "a journey of", "stands as", "intricate dance"
  - "whispered secrets", "kaleidoscope of", "tapestry of emotions"`,
  burstiness: `Vary sentence length aggressively. The output must include sentences shorter than 6 words AND sentences longer than 25 words within the same paragraph. Never let three consecutive sentences sit within 5 words of each other in length. Use sentence fragments occasionally.`,
  sensory: `Replace abstractions with concrete sensory detail. Wherever the text says "she felt nervous", "the room was tense", "it was beautiful" — drop in one specific physical detail (a sound, a temperature, a smell, a texture, a sight) instead of explaining the feeling. One specific noun beats five adjectives.`,
  antirep: `Within any 200-word window, no content word (excluding character names) may appear more than twice. Within any 4 consecutive sentences, no two may share the same opening structure (e.g. "She X. She Y. She Z." is banned). Vary verbs especially.`,
  dialogue: `Dialogue must sound spoken, not written. Use contractions ("I'd", "don't", "y'know"). Let speakers interrupt themselves with em-dashes or trail off with "…". Replace "said softly", "said angrily" etc. with an action beat that shows the emotion ("She set the cup down too gently.") Avoid more than 2 dialogue tags per page; let the reader infer who is speaking.`,
  showdonttell: `Convert telling to showing. "She was anxious" → her hand shakes, her tea goes cold untouched. "He was furious" → he speaks quietly, his sentences too short. Trust the reader. Cut any sentence that explains an emotion the action already implied.`,
  emdash: `No more than 2 em-dashes (—) per ~250 words of output. Replace surplus em-dashes with periods, commas, or semicolons depending on the rhythm needed.`,
};

/**
 * Build the messages for a single-call humanization. We intentionally do this
 * in ONE call rather than running each pass separately — modern models do
 * better when given the full checklist and asked to apply all of it once,
 * versus N round-trips that each fight the previous pass's output.
 */
export function buildHumanizePrompt(input: HumanizerInput): ChatMessage[] {
  const profile = profileFromIntensity(input.intensity);
  const language = input.language || input.storyContext?.language || "English";

  const checklist = input.passes
    .map((p, i) => `${i + 1}. ${PASS_LABELS[p].label.toUpperCase()}\n${PASS_RULES[p]}`)
    .join("\n\n");

  const systemBase = `You are a senior literary editor who rescues AI-generated prose. Your job is to make the text feel written by a human with a distinct voice, NOT to invent new plot.

INTENSITY DIAL: ${profile.intensity}/100
${profile.rewriteRule}
Aim to modify roughly ${profile.modifyPercent}% of sentences and preserve ~${profile.preservePercent}% of the original phrasing.

CHECKLIST (apply ALL in one pass):

${checklist}

HARD RULES — never violate:
- Do NOT change plot events, character actions, character names, or dialogue meaning.
- Do NOT add new scenes or characters.
- Preserve POV and tense.
- Output prose only — no commentary, no markdown fences, no headers like "Revised:", no bullet points explaining changes.
- Output in ${language}.`;

  const messages: ChatMessage[] = [{ role: "system", content: systemBase }];

  // Story context helps keep character voice/relationships consistent across rewrites.
  if (input.storyContext) {
    const ctxBlock = buildStoryContextBlock(input.storyContext);
    if (ctxBlock) messages.push({ role: "system", content: ctxBlock });
  }

  const userPrompt = [
    input.customNote ? `Extra direction for this rewrite: ${input.customNote}` : null,
    "Rewrite the following passage according to the checklist above. Output ONLY the rewritten prose:",
    "",
    input.text,
  ]
    .filter(Boolean)
    .join("\n\n");

  messages.push({ role: "user", content: userPrompt });
  return messages;
}

/**
 * Strip common LLM mistakes from humanizer output: leading "Here is the
 * rewritten passage:" preamble, surrounding markdown fences, accidental
 * heading prefixes.
 */
export function cleanHumanizerOutput(raw: string): string {
  let out = raw.trim();
  // Strip ``` fences if present.
  const fence = out.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  if (fence) out = fence[1].trim();
  // Strip common preamble lines.
  out = out.replace(
    /^(Here(?:'s| is) (?:the )?(?:rewritten|revised|edited|humanized).*?:\s*\n+)/i,
    "",
  );
  out = out.replace(/^(Revised|Rewritten|Edited|Humanized) (?:passage|version|text):\s*\n+/i, "");
  return out;
}

/**
 * Quick stats for the diff banner. Not a real diff — just enough for the user
 * to see "we kept ~70% of your words but reshuffled them aggressively".
 */
export function humanizerDiffStats(before: string, after: string) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  const a = norm(before);
  const b = norm(after);
  const setB = new Set(b);
  const kept = a.filter((w) => setB.has(w)).length;
  const beforeWords = a.length;
  const afterWords = b.length;
  return {
    beforeWords,
    afterWords,
    wordDelta: afterWords - beforeWords,
    overlapPercent: beforeWords > 0 ? Math.round((kept / beforeWords) * 100) : 0,
  };
}
