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
  userAchievements, type UserAchievement, type InsertUserAchievement
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
      temperature: settings.temperature || 700,
      maxTokens: settings.maxTokens || 4096,
      topP: settings.topP || 950,
      presencePenalty: settings.presencePenalty || 200,
      isDefault: settings.isDefault || false,
      createdAt: new Date(),
      updatedAt: new Date()
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
}

// Select the appropriate storage implementation based on database availability
export const storage: IStorage = useDatabase ? new DatabaseStorage() : new MemStorage();

log(`Using ${useDatabase ? 'database' : 'in-memory'} storage`, "storage");
