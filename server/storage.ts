import { 
  users, type User, type InsertUser,
  books, type Book, type InsertBook,
  chapters, type Chapter, type InsertChapter,
  llmSettings, type LlmSettings, type InsertLlmSettings,
  autoEditSettings, type AutoEditSettings, type InsertAutoEditSettings,
  dbSettings, type DbSettings, type InsertDbSettings,
  edits, type Edit, type InsertEdit,
  writingActivities, type WritingActivity, type InsertWritingActivity,
  achievements, type Achievement, type InsertAchievement,
  userAchievements, type UserAchievement, type InsertUserAchievement,
  userApiKeys, type UserApiKey, type InsertUserApiKey,
  usageEvents, type UsageEvent, type InsertUsageEvent,
  bookBibles, type BookBible, type InsertBookBible,
  steeringNotes, type SteeringNote, type InsertSteeringNote,
  generations, type Generation, type InsertGeneration
} from "@shared/schema";
import { db, useDatabase } from "./db";
import { eq, desc, and, sql, asc, gte, lte } from "drizzle-orm";
import { log } from "./vite";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Book operations
  getBooks(userId: number): Promise<Book[]>;
  getBook(id: number): Promise<Book | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: number, book: Partial<InsertBook>): Promise<Book | undefined>;
  deleteBook(id: number): Promise<boolean>;
  getRecentBooks(userId: number, limit: number): Promise<Book[]>;
  
  // Chapter operations
  getChapters(bookId: number): Promise<Chapter[]>;
  getChapter(id: number): Promise<Chapter | undefined>;
  createChapter(chapter: InsertChapter): Promise<Chapter>;
  updateChapter(id: number, chapter: Partial<InsertChapter>): Promise<Chapter | undefined>;
  deleteChapter(id: number): Promise<boolean>;
  
  // LLM Settings operations
  getLlmSettings(id: number): Promise<LlmSettings | undefined>;
  getDefaultLlmSettings(): Promise<LlmSettings | undefined>;
  getAllLlmSettings(): Promise<LlmSettings[]>;
  createLlmSettings(settings: InsertLlmSettings): Promise<LlmSettings>;
  updateLlmSettings(id: number, settings: Partial<InsertLlmSettings>): Promise<LlmSettings | undefined>;
  
  // Auto-Edit Settings operations
  getAutoEditSettings(userId: number): Promise<AutoEditSettings | undefined>;
  createAutoEditSettings(settings: InsertAutoEditSettings): Promise<AutoEditSettings>;
  updateAutoEditSettings(id: number, settings: Partial<InsertAutoEditSettings>): Promise<AutoEditSettings | undefined>;
  
  // Edits history operations
  getEdits(chapterId: number): Promise<Edit[]>;
  createEdit(edit: InsertEdit): Promise<Edit>;
  
  // DB Settings operations
  getDbSettings(userId: number): Promise<DbSettings | undefined>;
  createDbSettings(settings: InsertDbSettings): Promise<DbSettings>;
  updateDbSettings(id: number, settings: Partial<InsertDbSettings>): Promise<DbSettings | undefined>;
  
  // Stats operations
  getBookStats(userId: number): Promise<{ totalBooks: number, totalChapters: number, totalWords: number }>;
  
  // Writing Activities operations
  getWritingActivities(userId: number, startDate: Date, endDate: Date): Promise<WritingActivity[]>;
  createWritingActivity(activity: InsertWritingActivity): Promise<WritingActivity>;
  getWritingStreak(userId: number): Promise<number>;
  
  // Achievements operations
  getAchievements(): Promise<Achievement[]>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  getUserAchievements(userId: number): Promise<(UserAchievement & { achievement: Achievement })[]>;
  addUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement>;
  checkAndAwardAchievements(userId: number): Promise<(UserAchievement & { achievement: Achievement })[]>;

  // BYOK API key operations (encryptedKey is base64-encoded ciphertext, never plaintext)
  listUserApiKeys(userId: number): Promise<UserApiKey[]>;
  getUserApiKey(id: number, userId: number): Promise<UserApiKey | undefined>;
  getActiveUserApiKeyForProvider(userId: number, provider: string): Promise<UserApiKey | undefined>;
  createUserApiKey(input: {
    userId: number;
    provider: UserApiKey["provider"];
    label: string;
    encryptedKey: string;
    keyPreview: string;
    baseUrl?: string | null;
    defaultModel?: string | null;
    isActive?: boolean;
  }): Promise<UserApiKey>;
  updateUserApiKey(
    id: number,
    userId: number,
    patch: Partial<{
      label: string;
      encryptedKey: string;
      keyPreview: string;
      baseUrl: string | null;
      defaultModel: string | null;
      isActive: boolean;
    }>,
  ): Promise<UserApiKey | undefined>;
  deleteUserApiKey(id: number, userId: number): Promise<boolean>;
  touchUserApiKey(id: number): Promise<void>;

  // Usage event operations
  createUsageEvent(event: InsertUsageEvent): Promise<UsageEvent>;
  listUsageEvents(userId: number, limit?: number): Promise<UsageEvent[]>;
  getMonthlyPlatformUsage(userId: number): Promise<number>;
  getUsageSummary(userId: number): Promise<{
    monthMicroCents: number;
    totalTokens: number;
    callCount: number;
    byProvider: { provider: string; tokens: number; costMicroCents: number; calls: number }[];
  }>;

  // Book bible (story context) operations
  getBookBible(bookId: number): Promise<BookBible | undefined>;
  upsertBookBible(input: InsertBookBible): Promise<BookBible>;
  updateBookBible(bookId: number, patch: Partial<InsertBookBible>): Promise<BookBible | undefined>;

  // Steering notes operations
  listSteeringNotes(bookId: number, opts?: { activeOnly?: boolean; chapterId?: number | null }): Promise<SteeringNote[]>;
  createSteeringNote(note: InsertSteeringNote): Promise<SteeringNote>;
  updateSteeringNote(id: number, patch: Partial<InsertSteeringNote>): Promise<SteeringNote | undefined>;
  deleteSteeringNote(id: number): Promise<boolean>;

  // Generation (version history) operations
  createGeneration(gen: InsertGeneration): Promise<Generation>;
  updateGeneration(id: number, patch: Partial<InsertGeneration>): Promise<Generation | undefined>;
  listGenerations(filter: { userId: number; bookId?: number; chapterId?: number; kind?: Generation["kind"]; limit?: number }): Promise<Generation[]>;
  getGeneration(id: number, userId: number): Promise<Generation | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  // Writing Activities operations
  async getWritingActivities(userId: number, startDate: Date, endDate: Date): Promise<WritingActivity[]> {
    return db.select()
      .from(writingActivities)
      .where(
        and(
          eq(writingActivities.userId, userId),
          gte(writingActivities.createdAt, startDate),
          lte(writingActivities.createdAt, endDate)
        )
      )
      .orderBy(asc(writingActivities.createdAt));
  }
  
  async createWritingActivity(activity: InsertWritingActivity): Promise<WritingActivity> {
    const [newActivity] = await db.insert(writingActivities)
      .values({
        ...activity,
        wordCount: activity.wordCount || 0,
        bookId: activity.bookId || null,
        chapterId: activity.chapterId || null,
        activityDate: activity.activityDate || new Date().toISOString().split('T')[0]
      })
      .returning();
    return newActivity;
  }
  
  async getWritingStreak(userId: number): Promise<number> {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get activities sorted by date descending
    const recentActivities = await db.select({
      activityDate: writingActivities.activityDate
    })
      .from(writingActivities)
      .where(eq(writingActivities.userId, userId))
      .orderBy(desc(writingActivities.activityDate));
    
    if (recentActivities.length === 0) {
      return 0;
    }
    
    // Convert activity dates to Date objects for comparison
    const activityDates = recentActivities.map((a: {activityDate: string}) => new Date(a.activityDate));
    
    // Check if the most recent activity was today
    const latestDate = activityDates[0];
    const todayStr = today.toISOString().split('T')[0];
    const latestDateStr = latestDate.toISOString().split('T')[0];
    
    if (latestDateStr !== todayStr) {
      // If latest activity wasn't today, check if it was yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (latestDateStr !== yesterdayStr) {
        // If latest activity wasn't yesterday either, streak is broken
        return 0;
      }
    }
    
    // Count consecutive days
    let streak = 1;
    let currentDate = new Date(latestDate);
    
    for (let i = 1; i < activityDates.length; i++) {
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      
      const prevDateStr = prevDate.toISOString().split('T')[0];
      const activityDateStr = activityDates[i].toISOString().split('T')[0];
      
      if (prevDateStr === activityDateStr) {
        streak++;
        currentDate = activityDates[i];
      } else {
        break;
      }
    }
    
    return streak;
  }
  
  // Achievements operations
  async getAchievements(): Promise<Achievement[]> {
    return db.select().from(achievements);
  }
  
  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const [newAchievement] = await db.insert(achievements)
      .values(achievement)
      .returning();
    return newAchievement;
  }
  
  async getUserAchievements(userId: number): Promise<(UserAchievement & { achievement: Achievement })[]> {
    return db.select({
      id: userAchievements.id,
      userId: userAchievements.userId,
      achievementId: userAchievements.achievementId,
      earnedAt: userAchievements.earnedAt,
      achievement: achievements
    })
      .from(userAchievements)
      .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(eq(userAchievements.userId, userId));
  }
  
  async addUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement> {
    const [newUserAchievement] = await db.insert(userAchievements)
      .values(userAchievement)
      .returning();
    return newUserAchievement;
  }
  
  async checkAndAwardAchievements(userId: number): Promise<(UserAchievement & { achievement: Achievement })[]> {
    // Get user stats
    const stats = await this.getBookStats(userId);
    
    // Get existing achievements
    const existingAchievements = await this.getUserAchievements(userId);
    const existingAchievementIds = existingAchievements.map(ua => ua.achievementId);
    
    // Get all achievements
    const allAchievements = await this.getAchievements();
    
    // Filter achievements that haven't been earned yet
    const unearnedAchievements = allAchievements.filter(
      a => !existingAchievementIds.includes(a.id)
    );
    
    const newlyEarnedAchievements: (UserAchievement & { achievement: Achievement })[] = [];
    
    // Check each unearned achievement
    for (const achievement of unearnedAchievements) {
      let earned = false;
      
      switch (achievement.type) {
        case "word_count":
          earned = stats.totalWords >= achievement.threshold;
          break;
        case "first_book":
          earned = stats.totalBooks >= achievement.threshold;
          break;
        case "chapter_completion":
          earned = stats.totalChapters >= achievement.threshold;
          break;
        case "book_completion":
          earned = stats.totalBooks >= achievement.threshold;
          break;
        // Add other achievement types as needed
      }
      
      if (earned) {
        const userAchievement = await this.addUserAchievement({
          userId,
          achievementId: achievement.id,
        });
        
        newlyEarnedAchievements.push({
          ...userAchievement,
          achievement
        });
      }
    }
    
    return newlyEarnedAchievements;
  }
  
  // Book operations
  async getBooks(userId: number): Promise<Book[]> {
    return await db.select().from(books).where(eq(books.userId, userId)).orderBy(desc(books.updatedAt));
  }
  
  async getBook(id: number): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book;
  }
  
  async createBook(book: InsertBook): Promise<Book> {
    const [newBook] = await db.insert(books).values(book).returning();
    return newBook;
  }
  
  async updateBook(id: number, bookData: Partial<InsertBook>): Promise<Book | undefined> {
    const [updatedBook] = await db
      .update(books)
      .set({
        ...bookData,
        updatedAt: new Date()
      })
      .where(eq(books.id, id))
      .returning();
    return updatedBook;
  }
  
  async deleteBook(id: number): Promise<boolean> {
    const result = await db.delete(books).where(eq(books.id, id));
    return result !== undefined;
  }
  
  async getRecentBooks(userId: number, limit: number): Promise<Book[]> {
    return await db
      .select()
      .from(books)
      .where(eq(books.userId, userId))
      .orderBy(desc(books.updatedAt))
      .limit(limit);
  }
  
  // Chapter operations
  async getChapters(bookId: number): Promise<Chapter[]> {
    return await db
      .select()
      .from(chapters)
      .where(eq(chapters.bookId, bookId))
      .orderBy(chapters.orderIndex);
  }
  
  async getChapter(id: number): Promise<Chapter | undefined> {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
    return chapter;
  }
  
  async createChapter(chapter: InsertChapter): Promise<Chapter> {
    const [newChapter] = await db.insert(chapters).values(chapter).returning();
    
    // Update book chapter count
    await db
      .update(books)
      .set({
        chapterCount: sql`${books.chapterCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(books.id, chapter.bookId));
    
    return newChapter;
  }
  
  async updateChapter(id: number, chapterData: Partial<InsertChapter>): Promise<Chapter | undefined> {
    const [updatedChapter] = await db
      .update(chapters)
      .set({
        ...chapterData,
        updatedAt: new Date()
      })
      .where(eq(chapters.id, id))
      .returning();
    
    if (updatedChapter && chapterData.content) {
      // Calculate word count
      const wordCount = chapterData.content.trim().split(/\s+/).length;
      
      // Update chapter word count
      await db
        .update(chapters)
        .set({ wordCount })
        .where(eq(chapters.id, id));
      
      // Get all chapters for the book to update total word count
      const chapter = await this.getChapter(id);
      if (chapter) {
        const bookChapters = await this.getChapters(chapter.bookId);
        const totalWords = bookChapters.reduce((sum, ch) => sum + ch.wordCount, 0);
        
        // Update book word count
        await db
          .update(books)
          .set({
            wordCount: totalWords,
            updatedAt: new Date()
          })
          .where(eq(books.id, chapter.bookId));
      }
    }
    
    return updatedChapter;
  }
  
  async deleteChapter(id: number): Promise<boolean> {
    // Get chapter to get book ID before deleting
    const chapter = await this.getChapter(id);
    if (!chapter) return false;
    
    const result = await db.delete(chapters).where(eq(chapters.id, id));
    
    // Update book chapter count
    if (chapter) {
      await db
        .update(books)
        .set({
          chapterCount: sql`${books.chapterCount} - 1`,
          updatedAt: new Date()
        })
        .where(eq(books.id, chapter.bookId));
      
      // Reorder remaining chapters
      const remainingChapters = await this.getChapters(chapter.bookId);
      for (let i = 0; i < remainingChapters.length; i++) {
        await db
          .update(chapters)
          .set({ orderIndex: i })
          .where(eq(chapters.id, remainingChapters[i].id));
      }
    }
    
    return result !== undefined;
  }
  
  // LLM Settings operations
  async getLlmSettings(id: number): Promise<LlmSettings | undefined> {
    const [settings] = await db.select().from(llmSettings).where(eq(llmSettings.id, id));
    return settings;
  }
  
  async getAllLlmSettings(): Promise<LlmSettings[]> {
    return await db
      .select()
      .from(llmSettings)
      .orderBy(desc(llmSettings.isDefault), desc(llmSettings.createdAt));
  }
  
  async getDefaultLlmSettings(): Promise<LlmSettings | undefined> {
    const [settings] = await db.select().from(llmSettings).where(eq(llmSettings.isDefault, true));
    return settings;
  }
  
  async createLlmSettings(settings: InsertLlmSettings): Promise<LlmSettings> {
    if (settings.isDefault) {
      // Unset any existing default
      await db
        .update(llmSettings)
        .set({ isDefault: false })
        .where(eq(llmSettings.isDefault, true));
    }
    
    const [newSettings] = await db.insert(llmSettings).values(settings).returning();
    return newSettings;
  }
  
  async updateLlmSettings(id: number, settings: Partial<InsertLlmSettings>): Promise<LlmSettings | undefined> {
    if (settings.isDefault) {
      // Unset any existing default
      await db
        .update(llmSettings)
        .set({ isDefault: false })
        .where(and(
          eq(llmSettings.isDefault, true),
          sql`${llmSettings.id} != ${id}`
        ));
    }
    
    const [updatedSettings] = await db
      .update(llmSettings)
      .set({
        ...settings,
        updatedAt: new Date()
      })
      .where(eq(llmSettings.id, id))
      .returning();
    
    return updatedSettings;
  }
  
  // Auto-Edit Settings operations
  async getAutoEditSettings(userId: number): Promise<AutoEditSettings | undefined> {
    const [settings] = await db
      .select()
      .from(autoEditSettings)
      .where(eq(autoEditSettings.userId, userId));
    return settings;
  }
  
  async createAutoEditSettings(settings: InsertAutoEditSettings): Promise<AutoEditSettings> {
    const [newSettings] = await db.insert(autoEditSettings).values(settings).returning();
    return newSettings;
  }
  
  async updateAutoEditSettings(id: number, settings: Partial<InsertAutoEditSettings>): Promise<AutoEditSettings | undefined> {
    const [updatedSettings] = await db
      .update(autoEditSettings)
      .set({
        ...settings,
        updatedAt: new Date()
      })
      .where(eq(autoEditSettings.id, id))
      .returning();
    
    return updatedSettings;
  }
  
  // Edits history operations
  async getEdits(chapterId: number): Promise<Edit[]> {
    return await db
      .select()
      .from(edits)
      .where(eq(edits.chapterId, chapterId))
      .orderBy(desc(edits.createdAt));
  }
  
  async createEdit(edit: InsertEdit): Promise<Edit> {
    const [newEdit] = await db.insert(edits).values(edit).returning();
    return newEdit;
  }
  
  // DB Settings operations
  async getDbSettings(userId: number): Promise<DbSettings | undefined> {
    const [settings] = await db
      .select()
      .from(dbSettings)
      .where(eq(dbSettings.userId, userId));
    return settings;
  }
  
  async createDbSettings(settings: InsertDbSettings): Promise<DbSettings> {
    const [newSettings] = await db.insert(dbSettings).values(settings).returning();
    return newSettings;
  }
  
  async updateDbSettings(id: number, settings: Partial<InsertDbSettings>): Promise<DbSettings | undefined> {
    const [updatedSettings] = await db
      .update(dbSettings)
      .set({
        ...settings,
        updatedAt: new Date()
      })
      .where(eq(dbSettings.id, id))
      .returning();
    
    return updatedSettings;
  }
  
  // Stats operations
  async getBookStats(userId: number): Promise<{ totalBooks: number, totalChapters: number, totalWords: number }> {
    // Get total books
    const userBooks = await this.getBooks(userId);
    const totalBooks = userBooks.length;
    
    // Aggregate total chapters and words
    let totalChapters = 0;
    let totalWords = 0;
    
    for (const book of userBooks) {
      totalChapters += book.chapterCount;
      totalWords += book.wordCount;
    }
    
    return {
      totalBooks,
      totalChapters,
      totalWords
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BYOK API keys
  // ───────────────────────────────────────────────────────────────────────────
  async listUserApiKeys(userId: number): Promise<UserApiKey[]> {
    return await db
      .select()
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, userId))
      .orderBy(desc(userApiKeys.updatedAt));
  }

  async getUserApiKey(id: number, userId: number): Promise<UserApiKey | undefined> {
    const [row] = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, userId)));
    return row;
  }

  async getActiveUserApiKeyForProvider(
    userId: number,
    provider: string,
  ): Promise<UserApiKey | undefined> {
    const [row] = await db
      .select()
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, userId),
          eq(userApiKeys.provider, provider as any),
          eq(userApiKeys.isActive, true),
        ),
      )
      .orderBy(desc(userApiKeys.lastUsedAt), desc(userApiKeys.updatedAt))
      .limit(1);
    return row;
  }

  async createUserApiKey(input: {
    userId: number;
    provider: UserApiKey["provider"];
    label: string;
    encryptedKey: string;
    keyPreview: string;
    baseUrl?: string | null;
    defaultModel?: string | null;
    isActive?: boolean;
  }): Promise<UserApiKey> {
    const [row] = await db
      .insert(userApiKeys)
      .values({
        userId: input.userId,
        provider: input.provider,
        label: input.label,
        encryptedKey: input.encryptedKey,
        keyPreview: input.keyPreview,
        baseUrl: input.baseUrl ?? null,
        defaultModel: input.defaultModel ?? null,
        isActive: input.isActive ?? true,
      })
      .returning();
    return row;
  }

  async updateUserApiKey(
    id: number,
    userId: number,
    patch: Partial<{
      label: string;
      encryptedKey: string;
      keyPreview: string;
      baseUrl: string | null;
      defaultModel: string | null;
      isActive: boolean;
    }>,
  ): Promise<UserApiKey | undefined> {
    const [row] = await db
      .update(userApiKeys)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, userId)))
      .returning();
    return row;
  }

  async deleteUserApiKey(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(userApiKeys)
      .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, userId)));
    return result !== undefined;
  }

  async touchUserApiKey(id: number): Promise<void> {
    await db
      .update(userApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(userApiKeys.id, id));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Usage events
  // ───────────────────────────────────────────────────────────────────────────
  async createUsageEvent(event: InsertUsageEvent): Promise<UsageEvent> {
    const [row] = await db.insert(usageEvents).values(event).returning();
    return row;
  }

  async listUsageEvents(userId: number, limit = 100): Promise<UsageEvent[]> {
    return await db
      .select()
      .from(usageEvents)
      .where(eq(usageEvents.userId, userId))
      .orderBy(desc(usageEvents.createdAt))
      .limit(limit);
  }

  async getMonthlyPlatformUsage(userId: number): Promise<number> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const [row] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${usageEvents.costMicroCents}), 0)`,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.userId, userId),
          eq(usageEvents.mode, "platform"),
          eq(usageEvents.success, true),
          gte(usageEvents.createdAt, start),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async getUsageSummary(userId: number): Promise<{
    monthMicroCents: number;
    totalTokens: number;
    callCount: number;
    byProvider: { provider: string; tokens: number; costMicroCents: number; calls: number }[];
  }> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totals] = await db
      .select({
        cost: sql<number>`COALESCE(SUM(${usageEvents.costMicroCents}), 0)`,
        tokens: sql<number>`COALESCE(SUM(${usageEvents.totalTokens}), 0)`,
        calls: sql<number>`COUNT(*)`,
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, userId), gte(usageEvents.createdAt, start)));

    const byProvider = await db
      .select({
        provider: usageEvents.provider,
        tokens: sql<number>`COALESCE(SUM(${usageEvents.totalTokens}), 0)`,
        costMicroCents: sql<number>`COALESCE(SUM(${usageEvents.costMicroCents}), 0)`,
        calls: sql<number>`COUNT(*)`,
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, userId), gte(usageEvents.createdAt, start)))
      .groupBy(usageEvents.provider);

    return {
      monthMicroCents: Number(totals?.cost ?? 0),
      totalTokens: Number(totals?.tokens ?? 0),
      callCount: Number(totals?.calls ?? 0),
      byProvider: byProvider.map((r: { provider: unknown; tokens: unknown; costMicroCents: unknown; calls: unknown }) => ({
        provider: String(r.provider),
        tokens: Number(r.tokens),
        costMicroCents: Number(r.costMicroCents),
        calls: Number(r.calls),
      })),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Story bible
  // ───────────────────────────────────────────────────────────────────────────
  async getBookBible(bookId: number): Promise<BookBible | undefined> {
    const [row] = await db.select().from(bookBibles).where(eq(bookBibles.bookId, bookId));
    return row;
  }

  async upsertBookBible(input: InsertBookBible): Promise<BookBible> {
    const existing = await this.getBookBible(input.bookId);
    if (existing) {
      const [row] = await db
        .update(bookBibles)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(bookBibles.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(bookBibles).values(input).returning();
    return row;
  }

  async updateBookBible(
    bookId: number,
    patch: Partial<InsertBookBible>,
  ): Promise<BookBible | undefined> {
    const [row] = await db
      .update(bookBibles)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(bookBibles.bookId, bookId))
      .returning();
    return row;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Steering notes
  // ───────────────────────────────────────────────────────────────────────────
  async listSteeringNotes(
    bookId: number,
    opts?: { activeOnly?: boolean; chapterId?: number | null },
  ): Promise<SteeringNote[]> {
    const conditions = [eq(steeringNotes.bookId, bookId)];
    if (opts?.activeOnly) conditions.push(eq(steeringNotes.isActive, true));
    if (opts?.chapterId !== undefined && opts.chapterId !== null) {
      conditions.push(eq(steeringNotes.chapterId, opts.chapterId));
    }
    return await db
      .select()
      .from(steeringNotes)
      .where(and(...conditions))
      .orderBy(desc(steeringNotes.priority), desc(steeringNotes.createdAt));
  }

  async createSteeringNote(note: InsertSteeringNote): Promise<SteeringNote> {
    const [row] = await db.insert(steeringNotes).values(note).returning();
    return row;
  }

  async updateSteeringNote(
    id: number,
    patch: Partial<InsertSteeringNote>,
  ): Promise<SteeringNote | undefined> {
    const [row] = await db
      .update(steeringNotes)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(steeringNotes.id, id))
      .returning();
    return row;
  }

  async deleteSteeringNote(id: number): Promise<boolean> {
    const r = await db.delete(steeringNotes).where(eq(steeringNotes.id, id));
    return r !== undefined;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Generations (version history)
  // ───────────────────────────────────────────────────────────────────────────
  async createGeneration(gen: InsertGeneration): Promise<Generation> {
    const [row] = await db.insert(generations).values(gen).returning();
    return row;
  }

  async updateGeneration(
    id: number,
    patch: Partial<InsertGeneration>,
  ): Promise<Generation | undefined> {
    const [row] = await db
      .update(generations)
      .set(patch)
      .where(eq(generations.id, id))
      .returning();
    return row;
  }

  async listGenerations(filter: {
    userId: number;
    bookId?: number;
    chapterId?: number;
    kind?: Generation["kind"];
    limit?: number;
  }): Promise<Generation[]> {
    const conds = [eq(generations.userId, filter.userId)];
    if (filter.bookId) conds.push(eq(generations.bookId, filter.bookId));
    if (filter.chapterId) conds.push(eq(generations.chapterId, filter.chapterId));
    if (filter.kind) conds.push(eq(generations.kind, filter.kind));
    return await db
      .select()
      .from(generations)
      .where(and(...conds))
      .orderBy(desc(generations.createdAt))
      .limit(filter.limit ?? 50);
  }

  async getGeneration(id: number, userId: number): Promise<Generation | undefined> {
    const [row] = await db
      .select()
      .from(generations)
      .where(and(eq(generations.id, id), eq(generations.userId, userId)));
    return row;
  }
}

// Memory storage implementation for when database is not available
export class MemStorage implements IStorage {
  private users: User[] = [];
  private books: Book[] = [];
  private chapters: Chapter[] = [];
  private llmSettings: LlmSettings[] = [];
  private autoEditSettings: AutoEditSettings[] = [];
  private edits: Edit[] = [];
  private dbSettings: DbSettings[] = [];
  private writingActivities: WritingActivity[] = [];
  private achievements: Achievement[] = [];
  private userAchievements: UserAchievement[] = [];
  private userApiKeys: UserApiKey[] = [];
  private usageEvents: UsageEvent[] = [];
  private bookBibles: BookBible[] = [];
  private steeringNotes: SteeringNote[] = [];
  private generations: Generation[] = [];

  // Counters for IDs
  private userId = 1;
  private bookId = 1;
  private chapterId = 1;
  private llmSettingsId = 1;
  private autoEditSettingsId = 1;
  private editId = 1;
  private dbSettingsId = 1;
  private writingActivityId = 1;
  private achievementId = 1;
  private userAchievementId = 1;
  private userApiKeyId = 1;
  private usageEventId = 1;
  private bookBibleId = 1;
  private steeringNoteId = 1;
  private generationId = 1;
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      id: this.userId++,
      username: user.username,
      password: user.password,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.push(newUser);
    return newUser;
  }
  
  // Book operations
  async getBooks(userId: number): Promise<Book[]> {
    return this.books.filter(book => book.userId === userId);
  }
  
  async getBook(id: number): Promise<Book | undefined> {
    return this.books.find(book => book.id === id);
  }
  
  async createBook(book: InsertBook): Promise<Book> {
    const newBook: Book = {
      id: this.bookId++,
      title: book.title,
      description: book.description || null,
      outline: book.outline || null,
      userId: book.userId,
      status: book.status || "draft",
      llmSettingsId: book.llmSettingsId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      wordCount: 0,
      chapterCount: 0
    };
    this.books.push(newBook);
    return newBook;
  }
  
  async updateBook(id: number, bookData: Partial<InsertBook>): Promise<Book | undefined> {
    const index = this.books.findIndex(book => book.id === id);
    if (index === -1) return undefined;
    
    const updatedBook: Book = {
      ...this.books[index],
      ...bookData,
      updatedAt: new Date()
    };
    this.books[index] = updatedBook;
    return updatedBook;
  }
  
  async deleteBook(id: number): Promise<boolean> {
    const index = this.books.findIndex(book => book.id === id);
    if (index === -1) return false;
    
    this.books.splice(index, 1);
    // Also delete related chapters
    this.chapters = this.chapters.filter(chapter => chapter.bookId !== id);
    return true;
  }
  
  async getRecentBooks(userId: number, limit: number): Promise<Book[]> {
    return this.books
      .filter(book => book.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }
  
  // Chapter operations
  async getChapters(bookId: number): Promise<Chapter[]> {
    return this.chapters
      .filter(chapter => chapter.bookId === bookId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }
  
  async getChapter(id: number): Promise<Chapter | undefined> {
    return this.chapters.find(chapter => chapter.id === id);
  }
  
  async createChapter(chapter: InsertChapter): Promise<Chapter> {
    const newChapter: Chapter = {
      id: this.chapterId++,
      title: chapter.title,
      content: chapter.content || null,
      outline: chapter.outline || null,
      status: chapter.status || "outline",
      bookId: chapter.bookId,
      orderIndex: chapter.orderIndex || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      wordCount: 0
    };
    this.chapters.push(newChapter);
    
    // Update book chapter count
    const bookIndex = this.books.findIndex(book => book.id === chapter.bookId);
    if (bookIndex !== -1) {
      this.books[bookIndex].chapterCount += 1;
      this.books[bookIndex].updatedAt = new Date();
    }
    
    return newChapter;
  }
  
  async updateChapter(id: number, chapterData: Partial<InsertChapter>): Promise<Chapter | undefined> {
    const index = this.chapters.findIndex(chapter => chapter.id === id);
    if (index === -1) return undefined;
    
    const updatedChapter: Chapter = {
      ...this.chapters[index],
      ...chapterData,
      updatedAt: new Date()
    };
    
    // Update word count if content changed
    if (chapterData.content) {
      const wordCount = chapterData.content.trim().split(/\s+/).length;
      updatedChapter.wordCount = wordCount;
      
      // Update book word count
      const bookChapters = this.chapters.filter(ch => ch.bookId === updatedChapter.bookId);
      const totalWords = bookChapters.reduce((sum, ch) => sum + ch.wordCount, 0);
      
      const bookIndex = this.books.findIndex(book => book.id === updatedChapter.bookId);
      if (bookIndex !== -1) {
        this.books[bookIndex].wordCount = totalWords;
        this.books[bookIndex].updatedAt = new Date();
      }
    }
    
    this.chapters[index] = updatedChapter;
    return updatedChapter;
  }
  
  async deleteChapter(id: number): Promise<boolean> {
    const chapterIndex = this.chapters.findIndex(chapter => chapter.id === id);
    if (chapterIndex === -1) return false;
    
    const chapter = this.chapters[chapterIndex];
    const bookId = chapter.bookId;
    
    // Remove chapter
    this.chapters.splice(chapterIndex, 1);
    
    // Update book chapter count
    const bookIndex = this.books.findIndex(book => book.id === bookId);
    if (bookIndex !== -1) {
      this.books[bookIndex].chapterCount -= 1;
      this.books[bookIndex].updatedAt = new Date();
    }
    
    // Reorder remaining chapters
    const remainingChapters = this.chapters.filter(ch => ch.bookId === bookId);
    remainingChapters.sort((a, b) => a.orderIndex - b.orderIndex);
    
    for (let i = 0; i < remainingChapters.length; i++) {
      const index = this.chapters.findIndex(ch => ch.id === remainingChapters[i].id);
      if (index !== -1) {
        this.chapters[index].orderIndex = i;
      }
    }
    
    return true;
  }
  
  // LLM Settings operations
  async getLlmSettings(id: number): Promise<LlmSettings | undefined> {
    return this.llmSettings.find(setting => setting.id === id);
  }
  
  async getAllLlmSettings(): Promise<LlmSettings[]> {
    return [...this.llmSettings].sort((a, b) => {
      // Sort by default first, then by creation date
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }
  
  async getDefaultLlmSettings(): Promise<LlmSettings | undefined> {
    return this.llmSettings.find(setting => setting.isDefault);
  }
  
  async createLlmSettings(settings: InsertLlmSettings): Promise<LlmSettings> {
    if (settings.isDefault) {
      // Unset any existing default
      for (const setting of this.llmSettings) {
        if (setting.isDefault) {
          setting.isDefault = false;
        }
      }
    }
    
    const newSettings: LlmSettings = {
      id: this.llmSettingsId++,
      name: settings.name || "Default Settings",
      model: settings.model || "deepseek",
      customModelUrl: settings.customModelUrl || null,
      apiKey: settings.apiKey || null,
      provider: settings.provider ?? null,
      modelId: settings.modelId ?? null,
      temperature: settings.temperature ?? 700,
      maxTokens: settings.maxTokens ?? 4096,
      topP: settings.topP ?? 950,
      presencePenalty: settings.presencePenalty ?? 200,
      writingStyle: settings.writingStyle ?? "descriptive",
      creativityLevel: settings.creativityLevel ?? 500,
      isDefault: settings.isDefault ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.llmSettings.push(newSettings);
    return newSettings;
  }
  
  async updateLlmSettings(id: number, settings: Partial<InsertLlmSettings>): Promise<LlmSettings | undefined> {
    const index = this.llmSettings.findIndex(setting => setting.id === id);
    if (index === -1) return undefined;
    
    if (settings.isDefault) {
      // Unset any existing default
      for (let i = 0; i < this.llmSettings.length; i++) {
        if (this.llmSettings[i].id !== id && this.llmSettings[i].isDefault) {
          this.llmSettings[i].isDefault = false;
        }
      }
    }
    
    const updatedSettings: LlmSettings = {
      ...this.llmSettings[index],
      ...settings,
      updatedAt: new Date()
    };
    this.llmSettings[index] = updatedSettings;
    return updatedSettings;
  }
  
  // Auto-Edit Settings operations
  async getAutoEditSettings(userId: number): Promise<AutoEditSettings | undefined> {
    return this.autoEditSettings.find(setting => setting.userId === userId);
  }
  
  async createAutoEditSettings(settings: InsertAutoEditSettings): Promise<AutoEditSettings> {
    const newSettings: AutoEditSettings = {
      id: this.autoEditSettingsId++,
      userId: settings.userId,
      grammarCheck: settings.grammarCheck ?? true,
      styleConsistency: settings.styleConsistency ?? true,
      contentImprovement: settings.contentImprovement ?? true,
      plagiarismCheck: settings.plagiarismCheck ?? false,
      templateType: settings.templateType ?? "none",
      customTemplate: settings.customTemplate ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.autoEditSettings.push(newSettings);
    return newSettings;
  }
  
  async updateAutoEditSettings(id: number, settings: Partial<InsertAutoEditSettings>): Promise<AutoEditSettings | undefined> {
    const index = this.autoEditSettings.findIndex(setting => setting.id === id);
    if (index === -1) return undefined;
    
    const updatedSettings: AutoEditSettings = {
      ...this.autoEditSettings[index],
      ...settings,
      updatedAt: new Date()
    };
    this.autoEditSettings[index] = updatedSettings;
    return updatedSettings;
  }
  
  // Edits history operations
  async getEdits(chapterId: number): Promise<Edit[]> {
    return this.edits
      .filter(edit => edit.chapterId === chapterId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async createEdit(edit: InsertEdit): Promise<Edit> {
    const newEdit: Edit = {
      id: this.editId++,
      ...edit,
      createdAt: new Date()
    };
    this.edits.push(newEdit);
    return newEdit;
  }
  
  // DB Settings operations
  async getDbSettings(userId: number): Promise<DbSettings | undefined> {
    return this.dbSettings.find(setting => setting.userId === userId);
  }
  
  async createDbSettings(settings: InsertDbSettings): Promise<DbSettings> {
    const newSettings: DbSettings = {
      id: this.dbSettingsId++,
      username: settings.username,
      password: settings.password,
      schema: settings.schema || "public",
      userId: settings.userId,
      host: settings.host || "localhost",
      port: settings.port || 5432,
      database: settings.database,
      useSsl: settings.useSsl ?? false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.dbSettings.push(newSettings);
    return newSettings;
  }
  
  async updateDbSettings(id: number, settings: Partial<InsertDbSettings>): Promise<DbSettings | undefined> {
    const index = this.dbSettings.findIndex(setting => setting.id === id);
    if (index === -1) return undefined;
    
    const updatedSettings: DbSettings = {
      ...this.dbSettings[index],
      ...settings,
      updatedAt: new Date()
    };
    this.dbSettings[index] = updatedSettings;
    return updatedSettings;
  }
  
  async getBookStats(userId: number): Promise<{ totalBooks: number, totalChapters: number, totalWords: number }> {
    const userBooks = this.books.filter(book => book.userId === userId);
    const totalBooks = userBooks.length;
    const totalChapters = userBooks.reduce((sum, book) => sum + book.chapterCount, 0);
    const totalWords = userBooks.reduce((sum, book) => sum + book.wordCount, 0);
    
    return { totalBooks, totalChapters, totalWords };
  }
  
  // Writing Activities operations
  async getWritingActivities(userId: number, startDate: Date, endDate: Date): Promise<WritingActivity[]> {
    return this.writingActivities.filter(activity => {
      const activityDate = new Date(activity.activityDate);
      return activity.userId === userId && 
             activityDate >= startDate && 
             activityDate <= endDate;
    });
  }
  
  async createWritingActivity(activity: InsertWritingActivity): Promise<WritingActivity> {
    const newActivity: WritingActivity = {
      ...activity,
      id: this.writingActivityId++,
      createdAt: new Date()
    };
    this.writingActivities.push(newActivity);
    return newActivity;
  }
  
  async getWritingStreak(userId: number): Promise<number> {
    // Sort activities by date in descending order
    const userActivities = this.writingActivities
      .filter(activity => activity.userId === userId)
      .sort((a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime());
    
    if (userActivities.length === 0) {
      return 0;
    }
    
    // Check if the most recent activity was today or yesterday
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mostRecentDate = new Date(userActivities[0].activityDate);
    const mostRecentDay = new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth(), mostRecentDate.getDate());
    
    if (mostRecentDay < today) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (mostRecentDay < yesterday) {
        // The streak is broken if the most recent activity was before yesterday
        return 0;
      }
    }
    
    // Count consecutive days with activities
    let streak = 1;
    let currentDate = mostRecentDay;
    
    for (let i = 1; i < userActivities.length; i++) {
      const activityDate = new Date(userActivities[i].activityDate);
      const activityDay = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());
      
      // Check if this activity was on the previous day
      const expectedPrevDay = new Date(currentDate);
      expectedPrevDay.setDate(expectedPrevDay.getDate() - 1);
      
      if (activityDay.getTime() === expectedPrevDay.getTime()) {
        streak++;
        currentDate = activityDay;
      } else if (activityDay.getTime() < expectedPrevDay.getTime()) {
        // We've encountered a gap, so the streak ends
        break;
      }
      // If the date is the same as currentDate, we just skip it (multiple activities on same day)
    }
    
    return streak;
  }
  
  // Achievements operations
  async getAchievements(): Promise<Achievement[]> {
    return [...this.achievements];
  }
  
  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const newAchievement: Achievement = {
      ...achievement,
      id: this.achievementId++,
      createdAt: new Date()
    };
    this.achievements.push(newAchievement);
    return newAchievement;
  }
  
  async getUserAchievements(userId: number): Promise<(UserAchievement & { achievement: Achievement })[]> {
    return this.userAchievements
      .filter(ua => ua.userId === userId)
      .map(ua => {
        const achievement = this.achievements.find(a => a.id === ua.achievementId);
        if (!achievement) {
          throw new Error(`Achievement with id ${ua.achievementId} not found`);
        }
        return {
          ...ua,
          achievement
        };
      });
  }
  
  async addUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement> {
    // Check if user already has this achievement
    const existing = this.userAchievements.find(
      ua => ua.userId === userAchievement.userId && ua.achievementId === userAchievement.achievementId
    );
    
    if (existing) {
      return existing;
    }
    
    const newUserAchievement: UserAchievement = {
      ...userAchievement,
      id: this.userAchievementId++,
      earnedAt: new Date()
    };
    
    this.userAchievements.push(newUserAchievement);
    return newUserAchievement;
  }
  
  async checkAndAwardAchievements(userId: number): Promise<(UserAchievement & { achievement: Achievement })[]> {
    // Get user stats
    const { totalBooks, totalChapters, totalWords } = await this.getBookStats(userId);
    const streak = await this.getWritingStreak(userId);
    
    // Get all achievements
    const allAchievements = await this.getAchievements();
    
    // Get user's current achievements
    const userAchievements = await this.getUserAchievements(userId);
    const userAchievementIds = userAchievements.map(ua => ua.achievementId);
    
    // Check for new achievements
    const newlyEarnedAchievements: (UserAchievement & { achievement: Achievement })[] = [];
    
    for (const achievement of allAchievements) {
      // Skip if user already has this achievement
      if (userAchievementIds.includes(achievement.id)) {
        continue;
      }
      
      let earned = false;
      
      // Check if user meets the criteria for this achievement
      switch (achievement.type) {
        case "word_count":
          earned = totalWords >= achievement.threshold;
          break;
        case "streak":
          earned = streak >= achievement.threshold;
          break;
        case "chapter_completion":
          earned = totalChapters >= achievement.threshold;
          break;
        case "book_completion":
          // Count completed books
          const completedBooks = this.books.filter(
            book => book.userId === userId && book.status === "completed"
          ).length;
          earned = completedBooks >= achievement.threshold;
          break;
        case "first_book":
          earned = totalBooks >= achievement.threshold;
          break;
        case "consistent_writer":
          // This would require more complex logic, just using a placeholder check
          const activeDays = this.writingActivities
            .filter(activity => activity.userId === userId)
            .map(activity => new Date(activity.activityDate).toDateString())
            .filter((date, index, self) => self.indexOf(date) === index)
            .length;
          earned = activeDays >= achievement.threshold;
          break;
      }
      
      if (earned) {
        const userAchievement = await this.addUserAchievement({
          userId,
          achievementId: achievement.id
        });
        
        newlyEarnedAchievements.push({
          ...userAchievement,
          achievement
        });
      }
    }
    
    return newlyEarnedAchievements;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BYOK API keys (in-memory)
  // ───────────────────────────────────────────────────────────────────────────
  async listUserApiKeys(userId: number): Promise<UserApiKey[]> {
    return this.userApiKeys
      .filter((k) => k.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getUserApiKey(id: number, userId: number): Promise<UserApiKey | undefined> {
    return this.userApiKeys.find((k) => k.id === id && k.userId === userId);
  }

  async getActiveUserApiKeyForProvider(
    userId: number,
    provider: string,
  ): Promise<UserApiKey | undefined> {
    return this.userApiKeys
      .filter((k) => k.userId === userId && k.provider === provider && k.isActive)
      .sort((a, b) => {
        const at = a.lastUsedAt?.getTime() ?? 0;
        const bt = b.lastUsedAt?.getTime() ?? 0;
        if (at !== bt) return bt - at;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      })[0];
  }

  async createUserApiKey(input: {
    userId: number;
    provider: UserApiKey["provider"];
    label: string;
    encryptedKey: string;
    keyPreview: string;
    baseUrl?: string | null;
    defaultModel?: string | null;
    isActive?: boolean;
  }): Promise<UserApiKey> {
    const row: UserApiKey = {
      id: this.userApiKeyId++,
      userId: input.userId,
      provider: input.provider,
      label: input.label,
      encryptedKey: input.encryptedKey,
      keyPreview: input.keyPreview,
      baseUrl: input.baseUrl ?? null,
      defaultModel: input.defaultModel ?? null,
      isActive: input.isActive ?? true,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.userApiKeys.push(row);
    return row;
  }

  async updateUserApiKey(
    id: number,
    userId: number,
    patch: Partial<{
      label: string;
      encryptedKey: string;
      keyPreview: string;
      baseUrl: string | null;
      defaultModel: string | null;
      isActive: boolean;
    }>,
  ): Promise<UserApiKey | undefined> {
    const idx = this.userApiKeys.findIndex((k) => k.id === id && k.userId === userId);
    if (idx === -1) return undefined;
    const updated: UserApiKey = {
      ...this.userApiKeys[idx],
      ...patch,
      updatedAt: new Date(),
    };
    this.userApiKeys[idx] = updated;
    return updated;
  }

  async deleteUserApiKey(id: number, userId: number): Promise<boolean> {
    const idx = this.userApiKeys.findIndex((k) => k.id === id && k.userId === userId);
    if (idx === -1) return false;
    this.userApiKeys.splice(idx, 1);
    return true;
  }

  async touchUserApiKey(id: number): Promise<void> {
    const idx = this.userApiKeys.findIndex((k) => k.id === id);
    if (idx === -1) return;
    this.userApiKeys[idx].lastUsedAt = new Date();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Usage events (in-memory)
  // ───────────────────────────────────────────────────────────────────────────
  async createUsageEvent(event: InsertUsageEvent): Promise<UsageEvent> {
    const row: UsageEvent = {
      id: this.usageEventId++,
      userId: event.userId,
      apiKeyId: event.apiKeyId ?? null,
      provider: event.provider,
      model: event.model,
      mode: event.mode,
      feature: event.feature ?? null,
      bookId: event.bookId ?? null,
      chapterId: event.chapterId ?? null,
      promptTokens: event.promptTokens ?? 0,
      completionTokens: event.completionTokens ?? 0,
      totalTokens: event.totalTokens ?? 0,
      costMicroCents: event.costMicroCents ?? 0,
      durationMs: event.durationMs ?? 0,
      success: event.success ?? true,
      errorMessage: event.errorMessage ?? null,
      createdAt: new Date(),
    };
    this.usageEvents.push(row);
    return row;
  }

  async listUsageEvents(userId: number, limit = 100): Promise<UsageEvent[]> {
    return this.usageEvents
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getMonthlyPlatformUsage(userId: number): Promise<number> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.usageEvents
      .filter(
        (e) =>
          e.userId === userId &&
          e.mode === "platform" &&
          e.success &&
          e.createdAt >= start,
      )
      .reduce((sum, e) => sum + (e.costMicroCents || 0), 0);
  }

  async getUsageSummary(userId: number) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const events = this.usageEvents.filter((e) => e.userId === userId && e.createdAt >= start);
    const byProviderMap = new Map<string, { tokens: number; costMicroCents: number; calls: number }>();
    let monthMicroCents = 0;
    let totalTokens = 0;
    for (const e of events) {
      monthMicroCents += e.costMicroCents || 0;
      totalTokens += e.totalTokens || 0;
      const cur = byProviderMap.get(e.provider) || { tokens: 0, costMicroCents: 0, calls: 0 };
      cur.tokens += e.totalTokens || 0;
      cur.costMicroCents += e.costMicroCents || 0;
      cur.calls += 1;
      byProviderMap.set(e.provider, cur);
    }
    return {
      monthMicroCents,
      totalTokens,
      callCount: events.length,
      byProvider: Array.from(byProviderMap.entries()).map(([provider, v]) => ({ provider, ...v })),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Story bible (in-memory)
  // ───────────────────────────────────────────────────────────────────────────
  async getBookBible(bookId: number): Promise<BookBible | undefined> {
    return this.bookBibles.find((b) => b.bookId === bookId);
  }

  async upsertBookBible(input: InsertBookBible): Promise<BookBible> {
    const existing = await this.getBookBible(input.bookId);
    if (existing) {
      const updated: BookBible = {
        ...existing,
        ...input,
        entities: (input.entities ?? existing.entities) as any,
        updatedAt: new Date(),
      };
      const idx = this.bookBibles.findIndex((b) => b.id === existing.id);
      this.bookBibles[idx] = updated;
      return updated;
    }
    const row: BookBible = {
      id: this.bookBibleId++,
      bookId: input.bookId,
      premise: input.premise ?? null,
      setting: input.setting ?? null,
      themes: input.themes ?? null,
      styleGuide: input.styleGuide ?? null,
      glossary: input.glossary ?? null,
      entities: (input.entities ?? {}) as any,
      rollingSummary: input.rollingSummary ?? null,
      language: input.language ?? "English",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.bookBibles.push(row);
    return row;
  }

  async updateBookBible(
    bookId: number,
    patch: Partial<InsertBookBible>,
  ): Promise<BookBible | undefined> {
    const idx = this.bookBibles.findIndex((b) => b.bookId === bookId);
    if (idx === -1) return undefined;
    const updated: BookBible = {
      ...this.bookBibles[idx],
      ...patch,
      entities: (patch.entities ?? this.bookBibles[idx].entities) as any,
      updatedAt: new Date(),
    };
    this.bookBibles[idx] = updated;
    return updated;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Steering notes (in-memory)
  // ───────────────────────────────────────────────────────────────────────────
  async listSteeringNotes(
    bookId: number,
    opts?: { activeOnly?: boolean; chapterId?: number | null },
  ): Promise<SteeringNote[]> {
    return this.steeringNotes
      .filter((n) => {
        if (n.bookId !== bookId) return false;
        if (opts?.activeOnly && !n.isActive) return false;
        if (opts?.chapterId !== undefined && opts.chapterId !== null && n.chapterId !== opts.chapterId) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  async createSteeringNote(note: InsertSteeringNote): Promise<SteeringNote> {
    const row: SteeringNote = {
      id: this.steeringNoteId++,
      bookId: note.bookId,
      chapterId: note.chapterId ?? null,
      scope: note.scope ?? "book",
      note: note.note,
      isActive: note.isActive ?? true,
      priority: note.priority ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.steeringNotes.push(row);
    return row;
  }

  async updateSteeringNote(
    id: number,
    patch: Partial<InsertSteeringNote>,
  ): Promise<SteeringNote | undefined> {
    const idx = this.steeringNotes.findIndex((n) => n.id === id);
    if (idx === -1) return undefined;
    const updated: SteeringNote = {
      ...this.steeringNotes[idx],
      ...patch,
      updatedAt: new Date(),
    };
    this.steeringNotes[idx] = updated;
    return updated;
  }

  async deleteSteeringNote(id: number): Promise<boolean> {
    const idx = this.steeringNotes.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    this.steeringNotes.splice(idx, 1);
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Generations / version history (in-memory)
  // ───────────────────────────────────────────────────────────────────────────
  async createGeneration(gen: InsertGeneration): Promise<Generation> {
    const row: Generation = {
      id: this.generationId++,
      userId: gen.userId,
      bookId: gen.bookId ?? null,
      chapterId: gen.chapterId ?? null,
      kind: gen.kind,
      status: gen.status ?? "pending",
      provider: gen.provider,
      model: gen.model,
      mode: gen.mode,
      prompt: (gen.prompt ?? []) as any,
      output: gen.output ?? "",
      promptTokens: gen.promptTokens ?? 0,
      completionTokens: gen.completionTokens ?? 0,
      totalTokens: gen.totalTokens ?? 0,
      costMicroCents: gen.costMicroCents ?? 0,
      durationMs: gen.durationMs ?? 0,
      errorMessage: gen.errorMessage ?? null,
      metadata: (gen.metadata ?? {}) as any,
      createdAt: new Date(),
    };
    this.generations.push(row);
    return row;
  }

  async updateGeneration(
    id: number,
    patch: Partial<InsertGeneration>,
  ): Promise<Generation | undefined> {
    const idx = this.generations.findIndex((g) => g.id === id);
    if (idx === -1) return undefined;
    const updated: Generation = { ...this.generations[idx], ...(patch as any) };
    this.generations[idx] = updated;
    return updated;
  }

  async listGenerations(filter: {
    userId: number;
    bookId?: number;
    chapterId?: number;
    kind?: Generation["kind"];
    limit?: number;
  }): Promise<Generation[]> {
    return this.generations
      .filter((g) => {
        if (g.userId !== filter.userId) return false;
        if (filter.bookId && g.bookId !== filter.bookId) return false;
        if (filter.chapterId && g.chapterId !== filter.chapterId) return false;
        if (filter.kind && g.kind !== filter.kind) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, filter.limit ?? 50);
  }

  async getGeneration(id: number, userId: number): Promise<Generation | undefined> {
    return this.generations.find((g) => g.id === id && g.userId === userId);
  }
}

// Select the appropriate storage implementation based on database availability
export const storage: IStorage = useDatabase ? new DatabaseStorage() : new MemStorage();

log(`Using ${useDatabase ? 'database' : 'in-memory'} storage`, "storage");
