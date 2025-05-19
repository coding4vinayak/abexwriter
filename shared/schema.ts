import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

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

// LLM Model type enum
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

// LLM Settings
export const llmSettings = pgTable("llm_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Default Settings"),
  model: llmModelEnum("model").notNull().default("deepseek"),
  customModelUrl: text("custom_model_url"),
  apiKey: text("api_key"),
  temperature: integer("temperature").notNull().default(700), // Store as integer (x1000)
  maxTokens: integer("max_tokens").notNull().default(4096),
  topP: integer("top_p").notNull().default(950), // Store as integer (x1000)
  presencePenalty: integer("presence_penalty").notNull().default(200), // Store as integer (x1000)
  writingStyle: writingStyleEnum("writing_style").notNull().default("descriptive"),
  creativityLevel: integer("creativity_level").notNull().default(500), // Store as integer (x1000)
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
