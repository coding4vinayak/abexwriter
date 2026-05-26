import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { hashPassword, verifyPassword } from "./auth";
import { registerMcpRoutes } from "./mcp";
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
  // ──────────────────────────────────────────────────────────────────────
  // Auth routes (session-based)
  // ──────────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = z.object({
        username: z.string().min(3).max(50),
        password: z.string().min(6).max(128),
      }).parse(req.body);

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ error: "Username already taken" });
      }

      const passwordHash = hashPassword(password);
      const user = await storage.createUser({ username, password: passwordHash });

      (req.session as any).userId = user.id;
      res.status(201).json({ id: user.id, username: user.username });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }).parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const valid = verifyPassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      (req.session as any).userId = user.id;
      res.json({ id: user.id, username: user.username });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({ id: user.id, username: user.username });
  });

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
  // Export routes (DOCX, PDF, Text, EPUB)
  // ──────────────────────────────────────────────────────────────────────
  app.get("/api/books/:id/export/docx", async (req, res) => {
    try {
      const { exportToDocx } = await import("./export");
      const bookId = Number(req.params.id);
      const buffer = await exportToDocx(bookId);
      const book = await storage.getBook(bookId);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${(book?.title || "book").replace(/"/g, "")}.docx"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  app.get("/api/books/:id/export/pdf", async (req, res) => {
    try {
      const { exportToPdf } = await import("./export");
      const bookId = Number(req.params.id);
      const buffer = await exportToPdf(bookId);
      const book = await storage.getBook(bookId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${(book?.title || "book").replace(/"/g, "")}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "PDF export failed" });
    }
  });

  app.get("/api/books/:id/export/text", async (req, res) => {
    try {
      const { exportToText } = await import("./export");
      const bookId = Number(req.params.id);
      const text = await exportToText(bookId);
      const book = await storage.getBook(bookId);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${(book?.title || "book").replace(/"/g, "")}.txt"`);
      res.send(text);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Text export failed" });
    }
  });

  app.get("/api/books/:id/export/epub", async (req, res) => {
    try {
      const { exportToEpub } = await import("./export-epub");
      const bookId = Number(req.params.id);
      const buffer = await exportToEpub(bookId);
      const book = await storage.getBook(bookId);
      res.setHeader("Content-Type", "application/epub+zip");
      res.setHeader("Content-Disposition", `attachment; filename="${(book?.title || "book").replace(/"/g, "")}.epub"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "EPUB export failed" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // Beat Sheet Templates
  // ──────────────────────────────────────────────────────────────────────
  app.get("/api/templates/beat-sheets", (_req, res) => {
    res.json([
      { id: "save-the-cat", name: "Save the Cat", beats: ["Opening Image", "Theme Stated", "Set-Up", "Catalyst", "Debate", "Break into Two", "B Story", "Fun and Games", "Midpoint", "Bad Guys Close In", "All Is Lost", "Dark Night of the Soul", "Break into Three", "Finale", "Final Image"] },
      { id: "heros-journey", name: "Hero's Journey", beats: ["Ordinary World", "Call to Adventure", "Refusal of the Call", "Meeting the Mentor", "Crossing the Threshold", "Tests, Allies, Enemies", "Approach to the Inmost Cave", "Ordeal", "Reward", "The Road Back", "Resurrection", "Return with the Elixir"] },
      { id: "three-act", name: "Three-Act Structure", beats: ["Act 1: Setup", "Inciting Incident", "Plot Point 1", "Act 2: Confrontation", "Midpoint", "Plot Point 2", "Act 3: Resolution", "Climax", "Denouement"] },
      { id: "snowflake", name: "Snowflake Method", beats: ["One-Sentence Summary", "One-Paragraph Summary", "Character Summaries", "Expand to One Page", "Character Synopses", "Expand to Four Pages", "Character Charts", "Scene List"] },
      { id: "fichtean-curve", name: "Fichtean Curve", beats: ["Crisis 1 (Inciting)", "Rising Action", "Crisis 2", "Rising Action", "Crisis 3", "Rising Action", "Climax", "Falling Action"] },
    ]);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Chapter Reorder
  // ──────────────────────────────────────────────────────────────────────
  app.put("/api/chapters/reorder", async (req, res) => {
    try {
      const { bookId, chapterIds } = z.object({
        bookId: z.number().int(),
        chapterIds: z.array(z.number().int()),
      }).parse(req.body);

      // Update orderIndex for each chapter
      for (let i = 0; i < chapterIds.length; i++) {
        await storage.updateChapter(chapterIds[i], { orderIndex: i });
      }

      const chapters = await storage.getChapters(bookId);
      res.json(chapters);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to reorder chapters" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // Style DNA Fingerprint
  // ──────────────────────────────────────────────────────────────────────
  app.post("/api/books/:id/style-dna", async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      const { sampleText, provider, model, mode, apiKeyId } = z.object({
        sampleText: z.string().min(500, "Need at least 500 characters of sample text"),
        provider: z.string().min(1),
        model: z.string().min(1),
        mode: z.enum(["byok", "platform"]).default("byok"),
        apiKeyId: z.number().int().optional(),
      }).parse(req.body);

      const { generateChat, errorToHttpStatus } = await import("./llm/client");
      const userId = ((req as any).session?.userId as number) ?? 1;

      const messages = [
        {
          role: "system" as const,
          content: "You are a writing style analyst. Analyze the given writing sample and extract a comprehensive style fingerprint. Report the following in a clear, readable format:\n\n- Average sentence length (short/medium/long)\n- Vocabulary level (simple/moderate/literary)\n- Dialogue frequency (percentage of text)\n- Metaphor density (sparse/moderate/rich)\n- POV (first/second/third limited/third omniscient)\n- Tense (past/present)\n- Paragraph length tendency (short/medium/long)\n- Distinctive patterns (3-5 unique voice markers)\n- Forbidden patterns (things this author avoids)\n\nFormat as a clean style guide that can be used to instruct an AI to write in this style.",
        },
        {
          role: "user" as const,
          content: `Analyze this writing sample and extract its style fingerprint:\n\n${sampleText.slice(0, 8000)}`,
        },
      ];

      const result = await generateChat({
        userId,
        providerId: provider as any,
        mode,
        apiKeyId,
        model,
        messages,
        temperature: 0.3,
        maxTokens: 2000,
        feature: "style_dna",
        bookId,
      });

      // Save to book bible styleGuide
      const bible = await storage.getBookBible(bookId);
      if (bible) {
        await storage.updateBookBible(bookId, { styleGuide: result.text });
      } else {
        await storage.upsertBookBible({
          bookId,
          styleGuide: result.text,
          entities: {},
          language: "English",
        });
      }

      res.json({ styleGuide: result.text, usage: result });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      const { errorToHttpStatus } = await import("./llm/client");
      const { status, message } = errorToHttpStatus(error);
      res.status(status).json({ error: message });
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // LLM generation, BYOK API keys, story bible, steering, generations →
  // see server/llm/routes.ts. Replaces the previous simulated handlers.
  // ──────────────────────────────────────────────────────────────────────
  await registerLlmRoutes(app);

  // ──────────────────────────────────────────────────────────────────────
  // MCP integration (skeleton) — see server/mcp.ts
  // ──────────────────────────────────────────────────────────────────────
  registerMcpRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
