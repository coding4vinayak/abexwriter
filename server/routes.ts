import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertUserSchema, 
  insertBookSchema, 
  insertChapterSchema,
  insertLlmSettingsSchema,
  insertAutoEditSettingsSchema,
  insertDbSettingsSchema,
  insertEditSchema,
  insertWritingActivitySchema,
  insertAchievementSchema,
  insertUserAchievementSchema
} from "@shared/schema";
import { registerLlmRoutes } from "./llm/routes";

// Helper for handling zod validation
const validateBody = <T>(schema: z.ZodType<T>) => {
  return (req: Request, res: Response, next: () => void) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({ error: "Invalid request data", details: error });
    }
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // User routes
  app.post("/api/users", validateBody(insertUserSchema), async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });
  
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(Number(req.params.id));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Book routes
  app.get("/api/books", async (req, res) => {
    try {
      const userId = Number(req.query.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Valid userId query parameter is required" });
      }
      const books = await storage.getBooks(userId);
      res.json(books);
    } catch (error) {
      res.status(500).json({ error: "Failed to get books" });
    }
  });
  
  app.get("/api/books/recent", async (req, res) => {
    try {
      const userId = Number(req.query.userId);
      const limit = Number(req.query.limit) || 5;
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Valid userId query parameter is required" });
      }
      const books = await storage.getRecentBooks(userId, limit);
      res.json(books);
    } catch (error) {
      res.status(500).json({ error: "Failed to get recent books" });
    }
  });
  
  app.get("/api/books/:id", async (req, res) => {
    try {
      const book = await storage.getBook(Number(req.params.id));
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.json(book);
    } catch (error) {
      res.status(500).json({ error: "Failed to get book" });
    }
  });
  
  app.post("/api/books", validateBody(insertBookSchema), async (req, res) => {
    try {
      console.log("Creating book with data:", req.body);
      const book = await storage.createBook(req.body);
      console.log("Book created successfully:", book);
      res.status(201).json(book);
    } catch (error) {
      console.error("Error creating book:", error);
      res.status(500).json({ error: "Failed to create book", details: error instanceof Error ? error.message : String(error) });
    }
  });
  
  app.put("/api/books/:id", async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      const updateData = req.body;
      const book = await storage.updateBook(bookId, updateData);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.json(book);
    } catch (error) {
      res.status(500).json({ error: "Failed to update book" });
    }
  });
  
  app.delete("/api/books/:id", async (req, res) => {
    try {
      const success = await storage.deleteBook(Number(req.params.id));
      if (!success) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete book" });
    }
  });
  
  // Chapter routes
  app.get("/api/books/:bookId/chapters", async (req, res) => {
    try {
      const bookId = Number(req.params.bookId);
      const chapters = await storage.getChapters(bookId);
      res.json(chapters);
    } catch (error) {
      res.status(500).json({ error: "Failed to get chapters" });
    }
  });
  
  app.get("/api/chapters/:id", async (req, res) => {
    try {
      const chapter = await storage.getChapter(Number(req.params.id));
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      res.json(chapter);
    } catch (error) {
      res.status(500).json({ error: "Failed to get chapter" });
    }
  });
  
  app.post("/api/chapters", validateBody(insertChapterSchema), async (req, res) => {
    try {
      const chapter = await storage.createChapter(req.body);
      res.status(201).json(chapter);
    } catch (error) {
      res.status(500).json({ error: "Failed to create chapter" });
    }
  });
  
  app.put("/api/chapters/:id", async (req, res) => {
    try {
      const chapterId = Number(req.params.id);
      const updateData = req.body;
      const chapter = await storage.updateChapter(chapterId, updateData);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      res.json(chapter);
    } catch (error) {
      res.status(500).json({ error: "Failed to update chapter" });
    }
  });
  
  app.delete("/api/chapters/:id", async (req, res) => {
    try {
      const success = await storage.deleteChapter(Number(req.params.id));
      if (!success) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete chapter" });
    }
  });
  
  // LLM Settings routes
  app.get("/api/llm-settings", async (req, res) => {
    try {
      // For now, we return all settings regardless of user
      // In a multi-user setup, we would filter by userId
      const settings = await storage.getAllLlmSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get LLM settings" });
    }
  });
  
  app.get("/api/llm-settings/default", async (req, res) => {
    try {
      const settings = await storage.getDefaultLlmSettings();
      if (!settings) {
        return res.status(404).json({ error: "Default LLM settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get default LLM settings" });
    }
  });
  
  app.post("/api/llm-settings/test-connection", async (req, res) => {
    // Legacy endpoint — forwards to /api/llm/test for compatibility with the
    // old Settings page. New code should call /api/llm/test directly.
    res.status(410).json({
      error: "This endpoint is deprecated. Use POST /api/llm/test instead.",
      hint: "Body: { provider, apiKey?, apiKeyId?, baseUrl?, model? }",
    });
  });
  
  app.get("/api/llm-settings/:id", async (req, res) => {
    try {
      const settings = await storage.getLlmSettings(Number(req.params.id));
      if (!settings) {
        return res.status(404).json({ error: "LLM settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get LLM settings" });
    }
  });
  
  app.post("/api/llm-settings", validateBody(insertLlmSettingsSchema), async (req, res) => {
    try {
      const settings = await storage.createLlmSettings(req.body);
      res.status(201).json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to create LLM settings" });
    }
  });
  
  app.put("/api/llm-settings/:id", async (req, res) => {
    try {
      const settingsId = Number(req.params.id);
      const updateData = req.body;
      const settings = await storage.updateLlmSettings(settingsId, updateData);
      if (!settings) {
        return res.status(404).json({ error: "LLM settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update LLM settings" });
    }
  });
  
  // Auto-Edit Settings routes
  app.get("/api/auto-edit-settings", async (req, res) => {
    try {
      const userId = Number(req.query.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Valid userId query parameter is required" });
      }
      let settings = await storage.getAutoEditSettings(userId);
      
      // Create default settings if none exist
      if (!settings) {
        console.log(`Creating default auto-edit settings for user ${userId}`);
        const defaultSettings = {
          userId: userId,
          grammarCheck: true,
          styleConsistency: true,
          contentImprovement: true,
          plagiarismCheck: false
        };
        settings = await storage.createAutoEditSettings(defaultSettings);
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error in auto-edit settings:", error);
      res.status(500).json({ error: "Failed to get auto-edit settings" });
    }
  });
  
  app.post("/api/auto-edit-settings", validateBody(insertAutoEditSettingsSchema), async (req, res) => {
    try {
      const settings = await storage.createAutoEditSettings(req.body);
      res.status(201).json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to create auto-edit settings" });
    }
  });
  
  app.put("/api/auto-edit-settings/:id", async (req, res) => {
    try {
      const settingsId = Number(req.params.id);
      const updateData = req.body;
      const settings = await storage.updateAutoEditSettings(settingsId, updateData);
      if (!settings) {
        return res.status(404).json({ error: "Auto-edit settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update auto-edit settings" });
    }
  });
  
  // Edits History routes
  app.get("/api/chapters/:chapterId/edits", async (req, res) => {
    try {
      const chapterId = Number(req.params.chapterId);
      const edits = await storage.getEdits(chapterId);
      res.json(edits);
    } catch (error) {
      res.status(500).json({ error: "Failed to get edits history" });
    }
  });
  
  app.post("/api/edits", validateBody(insertEditSchema), async (req, res) => {
    try {
      const edit = await storage.createEdit(req.body);
      res.status(201).json(edit);
    } catch (error) {
      res.status(500).json({ error: "Failed to create edit record" });
    }
  });
  
  // DB Settings routes
  app.get("/api/db-settings", async (req, res) => {
    try {
      const userId = Number(req.query.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Valid userId query parameter is required" });
      }
      const settings = await storage.getDbSettings(userId);
      if (!settings) {
        return res.status(404).json({ error: "DB settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get DB settings" });
    }
  });
  
  app.post("/api/db-settings", validateBody(insertDbSettingsSchema), async (req, res) => {
    try {
      const settings = await storage.createDbSettings(req.body);
      res.status(201).json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to create DB settings" });
    }
  });
  
  app.put("/api/db-settings/:id", async (req, res) => {
    try {
      const settingsId = Number(req.params.id);
      const updateData = req.body;
      const settings = await storage.updateDbSettings(settingsId, updateData);
      if (!settings) {
        return res.status(404).json({ error: "DB settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update DB settings" });
    }
  });
  
  // Stats routes
  app.get("/api/stats", async (req, res) => {
    try {
      const userId = Number(req.query.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Valid userId query parameter is required" });
      }
      const stats = await storage.getBookStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Writing Activities routes
  app.get("/api/writing-activities", async (req, res) => {
    try {
      const userId = Number(req.query.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Valid userId query parameter is required" });
      }
      
      // Default to last 30 days if no dates are provided
      const now = new Date();
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - 30);
      
      let startDate = defaultStartDate;
      let endDate = now;
      
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
      }
      
      const activities = await storage.getWritingActivities(userId, startDate, endDate);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to get writing activities" });
    }
  });
  
  app.post("/api/writing-activities", validateBody(insertWritingActivitySchema), async (req, res) => {
    try {
      const activity = await storage.createWritingActivity(req.body);
      res.status(201).json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to create writing activity" });
    }
  });
  
  app.get("/api/writing-streak", async (req, res) => {
    try {
      const userId = Number(req.query.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Valid userId query parameter is required" });
      }
      
      const streak = await storage.getWritingStreak(userId);
      res.json({ streak });
    } catch (error) {
      res.status(500).json({ error: "Failed to get writing streak" });
    }
  });
  
  // Achievement routes
  app.get("/api/achievements", async (req, res) => {
    try {
      const achievements = await storage.getAchievements();
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ error: "Failed to get achievements" });
    }
  });
  
  app.post("/api/achievements", validateBody(insertAchievementSchema), async (req, res) => {
    try {
      const achievement = await storage.createAchievement(req.body);
      res.status(201).json(achievement);
    } catch (error) {
      res.status(500).json({ error: "Failed to create achievement" });
    }
  });
  
  app.get("/api/user-achievements", async (req, res) => {
    try {
      const userId = Number(req.query.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Valid userId query parameter is required" });
      }
      
      const userAchievements = await storage.getUserAchievements(userId);
      res.json(userAchievements);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user achievements" });
    }
  });
  
  app.post("/api/user-achievements", validateBody(insertUserAchievementSchema), async (req, res) => {
    try {
      const userAchievement = await storage.addUserAchievement(req.body);
      res.status(201).json(userAchievement);
    } catch (error) {
      res.status(500).json({ error: "Failed to add user achievement" });
    }
  });
  
  app.post("/api/check-achievements", async (req, res) => {
    try {
      const userId = Number(req.body.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Valid userId is required" });
      }
      
      const newAchievements = await storage.checkAndAwardAchievements(userId);
      res.json(newAchievements);
    } catch (error) {
      res.status(500).json({ error: "Failed to check and award achievements" });
    }
  });
  // ──────────────────────────────────────────────────────────────────────
  // LLM generation, BYOK API keys, story bible, steering, generations →
  // see server/llm/routes.ts. Replaces the previous simulated handlers.
  // ──────────────────────────────────────────────────────────────────────
  registerLlmRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
