import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// LLM Model type enum (legacy — kept for backward compatibility with existing rows)
export const llmModelEnum = pgEnum("llm_model", [
  "deepseek",
  "llama",
  "mistral",
  "phi",
  "openai",
  "anthropic",
  "perplexity",
  "custom"
]);

// Provider enum — the canonical list of supported LLM providers.
// All "openai-compatible" providers can be invoked through the same /v1/chat/completions
// client; anthropic and gemini have their own native protocols.
export const providerEnum = pgEnum("llm_provider", [
  "openai",
  "anthropic",
  "deepseek",
  "groq",
  "together",
  "openrouter",
  "mistral",
  "perplexity",
  "xai",
  "fireworks",
  "anyscale",
  "gemini",
  "ollama",
  "custom"
]);

// Mode for an LLM call: BYOK (user-supplied key) or platform (server-managed key with quota).
export const llmModeEnum = pgEnum("llm_mode", ["byok", "platform"]);

// Book status enum
export const bookStatusEnum = pgEnum("book_status", [
  "draft",
  "in_progress",
  "completed",
  "archived"
]);

// Chapter status enum
export const chapterStatusEnum = pgEnum("chapter_status", [
  "outline",
  "draft",
  "in_progress",
  "completed",
  "edited"
]);

// Writing Style Enum
export const writingStyleEnum = pgEnum("writing_style", [
  "concise",
  "descriptive",
  "technical",
  "conversational",
  "lyrical",
  "humorous"
]);

// LLM Settings — generation presets (temperature, max tokens, etc.)
// `provider` + `modelId` (text) are the new canonical fields. The legacy `model` enum
// and plaintext `apiKey` columns are kept for backward compatibility but should not be
// used by new code. API keys now live in `userApiKeys` (encrypted).
export const llmSettings = pgTable("llm_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Default Settings"),
  // Legacy fields (deprecated — use provider/modelId instead).
  model: llmModelEnum("model").notNull().default("deepseek"),
  apiKey: text("api_key"),
  // New canonical fields.
  provider: providerEnum("provider"),
  modelId: text("model_id"), // e.g. "gpt-4o-mini", "claude-3-5-sonnet-20241022", "deepseek-chat"
  customModelUrl: text("custom_model_url"),
  // Generation parameters (stored as integers x1000 for precision, e.g. 700 = 0.7).
  temperature: integer("temperature").notNull().default(700),
  maxTokens: integer("max_tokens").notNull().default(4096),
  topP: integer("top_p").notNull().default(950),
  presencePenalty: integer("presence_penalty").notNull().default(200),
  writingStyle: writingStyleEnum("writing_style").notNull().default("descriptive"),
  creativityLevel: integer("creativity_level").notNull().default(500),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLlmSettingsSchema = createInsertSchema(llmSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLlmSettings = z.infer<typeof insertLlmSettingsSchema>;
export type LlmSettings = typeof llmSettings.$inferSelect;

// Books
export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  outline: text("outline"),
  status: bookStatusEnum("status").notNull().default("draft"),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  llmSettingsId: integer("llm_settings_id").references(() => llmSettings.id),
  wordCount: integer("word_count").notNull().default(0),
  chapterCount: integer("chapter_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const booksRelations = relations(books, ({ one, many }) => ({
  user: one(users, {
    fields: [books.userId],
    references: [users.id]
  }),
  llmSettings: one(llmSettings, {
    fields: [books.llmSettingsId],
    references: [llmSettings.id]
  }),
  chapters: many(chapters)
}));

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  wordCount: true,
  chapterCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof books.$inferSelect;

// Chapters
export const chapters = pgTable("chapters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").default(""),
  outline: text("outline"),
  status: chapterStatusEnum("status").notNull().default("outline"),
  orderIndex: integer("order_index").notNull(),
  bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  wordCount: integer("word_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chaptersRelations = relations(chapters, ({ one }) => ({
  book: one(books, {
    fields: [chapters.bookId],
    references: [books.id]
  })
}));

export const insertChapterSchema = createInsertSchema(chapters).omit({
  id: true,
  wordCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type Chapter = typeof chapters.$inferSelect;

// Writing Template Enum
export const templateTypeEnum = pgEnum("template_type", [
  "none",
  "novel",
  "academic",
  "technical",
  "business",
  "screenplay",
  "short_story",
  "nonfiction",
  "blog"
]);

// Auto-editing settings
export const autoEditSettings = pgTable("auto_edit_settings", {
  id: serial("id").primaryKey(),
  grammarCheck: boolean("grammar_check").notNull().default(true),
  styleConsistency: boolean("style_consistency").notNull().default(true),
  contentImprovement: boolean("content_improvement").notNull().default(true),
  plagiarismCheck: boolean("plagiarism_check").notNull().default(false),
  templateType: templateTypeEnum("template_type").notNull().default("none"),
  customTemplate: text("custom_template"),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const autoEditSettingsRelations = relations(autoEditSettings, ({ one }) => ({
  user: one(users, {
    fields: [autoEditSettings.userId],
    references: [users.id]
  })
}));

export const insertAutoEditSettingsSchema = createInsertSchema(autoEditSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAutoEditSettings = z.infer<typeof insertAutoEditSettingsSchema>;
export type AutoEditSettings = typeof autoEditSettings.$inferSelect;

// Edits history
export const edits = pgTable("edits", {
  id: serial("id").primaryKey(),
  chapterId: integer("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  previousContent: text("previous_content").notNull(),
  editType: text("edit_type").notNull(), // grammar, style, content
  changes: jsonb("changes").notNull(), // JSON with changes made
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const editsRelations = relations(edits, ({ one }) => ({
  chapter: one(chapters, {
    fields: [edits.chapterId],
    references: [chapters.id]
  })
}));

export const insertEditSchema = createInsertSchema(edits).omit({
  id: true,
  createdAt: true,
});

export type InsertEdit = z.infer<typeof insertEditSchema>;
export type Edit = typeof edits.$inferSelect;

// Database connection settings
export const dbSettings = pgTable("db_settings", {
  id: serial("id").primaryKey(),
  host: text("host").notNull().default("localhost"),
  port: integer("port").notNull().default(5432),
  database: text("database").notNull(),
  schema: text("schema").notNull().default("public"),
  username: text("username").notNull(),
  password: text("password").notNull(),
  useSsl: boolean("use_ssl").notNull().default(false),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const dbSettingsRelations = relations(dbSettings, ({ one }) => ({
  user: one(users, {
    fields: [dbSettings.userId],
    references: [users.id]
  })
}));

export const insertDbSettingsSchema = createInsertSchema(dbSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDbSettings = z.infer<typeof insertDbSettingsSchema>;
export type DbSettings = typeof dbSettings.$inferSelect;

// Writing activity tracking for heatmap
export const writingActivities = pgTable("writing_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookId: integer("book_id").references(() => books.id, { onDelete: "set null" }),
  chapterId: integer("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  wordCount: integer("word_count").notNull().default(0),
  activityDate: date("activity_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const writingActivitiesRelations = relations(writingActivities, ({ one }) => ({
  user: one(users, {
    fields: [writingActivities.userId],
    references: [users.id]
  }),
  book: one(books, {
    fields: [writingActivities.bookId],
    references: [books.id]
  }),
  chapter: one(chapters, {
    fields: [writingActivities.chapterId],
    references: [chapters.id]
  })
}));

export const insertWritingActivitySchema = createInsertSchema(writingActivities).omit({
  id: true,
  createdAt: true,
});

export type InsertWritingActivity = z.infer<typeof insertWritingActivitySchema>;
export type WritingActivity = typeof writingActivities.$inferSelect;

// Achievement badges
export const achievementTypeEnum = pgEnum("achievement_type", [
  "word_count",
  "streak",
  "chapter_completion",
  "book_completion",
  "first_book",
  "consistent_writer"
]);

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: achievementTypeEnum("type").notNull(),
  threshold: integer("threshold").notNull(), // The value needed to earn this achievement
  icon: text("icon").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});

export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;

// User achievements
export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: integer("achievement_id").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  earnedAt: timestamp("earned_at").notNull().defaultNow(),
});

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id]
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id]
  })
}));

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  earnedAt: true,
});

export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;



// ─────────────────────────────────────────────────────────────────────────────
// LLM provider API keys (BYOK — Bring Your Own Key).
// Keys are encrypted at rest with AES-256-GCM. The plaintext key never leaves
// the server-side `decryptApiKey()` helper. The API never returns the
// plaintext key — only a redacted preview (first 4 + last 4 chars).
// ─────────────────────────────────────────────────────────────────────────────
export const userApiKeys = pgTable("user_api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: providerEnum("provider").notNull(),
  label: text("label").notNull().default("Default"),
  encryptedKey: text("encrypted_key").notNull(),
  keyPreview: text("key_preview").notNull(), // e.g. "sk-…abcd"
  // Optional override for OpenAI-compatible endpoints (required when provider="custom").
  baseUrl: text("base_url"),
  // Optional preferred default model for this key, e.g. "gpt-4o-mini".
  defaultModel: text("default_model"),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(users, {
    fields: [userApiKeys.userId],
    references: [users.id],
  }),
}));

export const insertUserApiKeySchema = createInsertSchema(userApiKeys).omit({
  id: true,
  encryptedKey: true,
  keyPreview: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // The raw plaintext key is only accepted on input; it is never persisted plaintext.
  apiKey: z.string().min(1, "API key is required"),
});

export type InsertUserApiKey = z.infer<typeof insertUserApiKeySchema>;
export type UserApiKey = typeof userApiKeys.$inferSelect;

// Public-safe shape returned by the API (no encryptedKey).
export type UserApiKeyPublic = Omit<UserApiKey, "encryptedKey">;

// ─────────────────────────────────────────────────────────────────────────────
// Usage events — every LLM call (success or failure) records a row here for
// metering, billing, debugging and cost dashboards. Costs are stored as
// micro-cents (1/100 of a cent) for precision; e.g. 250 micro-cents = $0.0025.
// ─────────────────────────────────────────────────────────────────────────────
export const usageEvents = pgTable("usage_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  apiKeyId: integer("api_key_id").references(() => userApiKeys.id, { onDelete: "set null" }),
  provider: providerEnum("provider").notNull(),
  model: text("model").notNull(),
  mode: llmModeEnum("mode").notNull(),
  feature: text("feature"), // 'chapter_outline' | 'chapter_content' | 'rewrite' | 'expand' | 'test'
  bookId: integer("book_id").references(() => books.id, { onDelete: "set null" }),
  chapterId: integer("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  costMicroCents: integer("cost_micro_cents").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  user: one(users, { fields: [usageEvents.userId], references: [users.id] }),
  apiKey: one(userApiKeys, { fields: [usageEvents.apiKeyId], references: [userApiKeys.id] }),
  book: one(books, { fields: [usageEvents.bookId], references: [books.id] }),
  chapter: one(chapters, { fields: [usageEvents.chapterId], references: [chapters.id] }),
}));

export const insertUsageEventSchema = createInsertSchema(usageEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertUsageEvent = z.infer<typeof insertUsageEventSchema>;
export type UsageEvent = typeof usageEvents.$inferSelect;



// ─────────────────────────────────────────────────────────────────────────────
// Story bible / book context — characters, places, plot threads, themes,
// glossary, world rules. One row per book. Stored as a JSON blob so we can
// iterate the schema without migrations during early development. Phase 2
// will normalise this into per-entity tables (characters, locations, etc.)
// with relationships and embeddings for RAG.
// ─────────────────────────────────────────────────────────────────────────────
export const bookBibles = pgTable("book_bibles", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().unique().references(() => books.id, { onDelete: "cascade" }),
  // Free-form long-form notes the author wants the model to always remember.
  premise: text("premise"),
  setting: text("setting"),
  themes: text("themes"),
  styleGuide: text("style_guide"),
  glossary: text("glossary"),
  /**
   * Structured entities. Shape:
   * {
   *   characters: [{ name, role, description, arc, voice, relationships: [{to, type}] }],
   *   locations:  [{ name, description }],
   *   plotThreads:[{ name, status, description }],
   *   factions:   [{ name, description }],
   *   rules:      [string]                     // e.g. "magic costs memory"
   * }
   */
  entities: jsonb("entities").notNull().default(sql`'{}'::jsonb`),
  /** Chapter-by-chapter rolling summary, populated as chapters are written. */
  rollingSummary: text("rolling_summary"),
  language: text("language").notNull().default("English"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookBiblesRelations = relations(bookBibles, ({ one }) => ({
  book: one(books, { fields: [bookBibles.bookId], references: [books.id] }),
}));

export const insertBookBibleSchema = createInsertSchema(bookBibles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBookBible = z.infer<typeof insertBookBibleSchema>;
export type BookBible = typeof bookBibles.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// Steering notes — author directives that persist across generations.
// Examples: "kill off the king in chapter 14", "shift POV to Mira",
// "tone down the violence going forward". These get injected into the system
// prompt of every subsequent generation until the author marks them resolved.
// ─────────────────────────────────────────────────────────────────────────────
export const steeringScopeEnum = pgEnum("steering_scope", ["book", "chapter"]);

export const steeringNotes = pgTable("steering_notes", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  chapterId: integer("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  scope: steeringScopeEnum("scope").notNull().default("book"),
  note: text("note").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  /** Higher number = higher priority when many notes are stacked. */
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const steeringNotesRelations = relations(steeringNotes, ({ one }) => ({
  book: one(books, { fields: [steeringNotes.bookId], references: [books.id] }),
  chapter: one(chapters, { fields: [steeringNotes.chapterId], references: [chapters.id] }),
}));

export const insertSteeringNoteSchema = createInsertSchema(steeringNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSteeringNote = z.infer<typeof insertSteeringNoteSchema>;
export type SteeringNote = typeof steeringNotes.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// Generations — every LLM completion is persisted as a Generation row.
// This *is* the version history: a chapter can have N generations; the user
// picks one as "active" and applies it to the chapter content. Old versions
// remain available for diff / rollback.
// ─────────────────────────────────────────────────────────────────────────────
export const generationKindEnum = pgEnum("generation_kind", [
  "chapter_outline",
  "chapter_content",
  "rewrite",
  "expand",
  "shrink",
  "describe",
  "brainstorm",
  "character",
  "research",
  "translation",
  "custom",
]);

export const generationStatusEnum = pgEnum("generation_status", [
  "pending",
  "completed",
  "failed",
  "applied",       // user accepted this version into the chapter
  "discarded",
]);

export const generations = pgTable("generations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookId: integer("book_id").references(() => books.id, { onDelete: "cascade" }),
  chapterId: integer("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  kind: generationKindEnum("kind").notNull(),
  status: generationStatusEnum("status").notNull().default("pending"),
  provider: providerEnum("provider").notNull(),
  model: text("model").notNull(),
  mode: llmModeEnum("mode").notNull(),
  /** The composed prompt messages actually sent to the model. */
  prompt: jsonb("prompt").notNull().default(sql`'[]'::jsonb`),
  /** Raw model output text. */
  output: text("output").notNull().default(""),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  costMicroCents: integer("cost_micro_cents").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  errorMessage: text("error_message"),
  /** Additional structured context: temperature, target word count, etc. */
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const generationsRelations = relations(generations, ({ one }) => ({
  user: one(users, { fields: [generations.userId], references: [users.id] }),
  book: one(books, { fields: [generations.bookId], references: [books.id] }),
  chapter: one(chapters, { fields: [generations.chapterId], references: [chapters.id] }),
}));

export const insertGenerationSchema = createInsertSchema(generations).omit({
  id: true,
  createdAt: true,
});

export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generations.$inferSelect;
