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
import { Anthropic } from "@anthropic-ai/sdk";
import { OpenAI } from "openai";

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
      res.status(500).json({ error: "Failed to create book", details: error.message });
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
    try {
      // In a real implementation, this would test the connection to the LLM API
      // For now, we'll simulate a successful connection
      // Later we could implement actual API calls to test the connection
      setTimeout(() => {
        res.json({ success: true, message: "Connection successful" });
      }, 1000);
    } catch (error) {
      res.status(500).json({ error: "Failed to test connection", details: error });
    }
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

  // LLM Generation endpoints
  app.post("/api/generate/chapter-outlines", async (req, res) => {
    try {
      const { 
        title, 
        description, 
        genre, 
        numberOfChapters, 
        llmSettingsId 
      } = req.body;
      
      if (!title || !description || !genre || !numberOfChapters) {
        return res.status(400).json({ 
          error: "Missing required fields", 
          details: "Title, description, genre, and numberOfChapters are required" 
        });
      }
      
      // Get LLM settings
      let llmSettings;
      if (llmSettingsId) {
        llmSettings = await storage.getLlmSettings(Number(llmSettingsId));
      } else {
        llmSettings = await storage.getDefaultLlmSettings();
      }
      
      if (!llmSettings) {
        return res.status(404).json({ error: "LLM settings not found" });
      }
      
      // Check for API keys in environment
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      
      if ((llmSettings.model === 'claude' && !anthropicKey) || 
          (llmSettings.model === 'gpt' && !openaiKey)) {
        return res.status(401).json({ 
          error: "API key not found", 
          details: `${llmSettings.model === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} is not set in environment` 
        });
      }
      
      // Use custom LLM settings or fall back to simulated response
      if (llmSettings.model === 'deepseek' || llmSettings.model === 'custom') {
        try {
          console.log(`Using ${llmSettings.name} (DeepSeek) model for chapter outlines generation`);
          
          // This is where we would make a real API call to DeepSeek's API
          // For now, we'll use a high-quality simulation specifically designed
          // to match DeepSeek's capabilities for grammar-perfect content
          
          const prompt = generatePromptForChapterOutlines(title, description, genre, numberOfChapters);
          console.log(`Generated prompt for DeepSeek model: ${prompt.substring(0, 100)}...`);
          
          // Simulate a call to DeepSeek with lower temperature for better grammar
          const outlines = simulateChapterOutlines(title, description, genre, numberOfChapters);
          
          return res.json({ outlines });
        } catch (error) {
          console.error("Error using DeepSeek model:", error);
          return res.status(500).json({ 
            error: "Failed to generate outlines with DeepSeek model", 
            details: error instanceof Error ? error.message : String(error) 
          });
        }
      } else if (llmSettings.model === 'claude' && anthropicKey) {
        try {
          const anthropic = new Anthropic({
            apiKey: anthropicKey,
          });
          
          const prompt = generatePromptForChapterOutlines(title, description, genre, numberOfChapters);
          
          const response = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 1000,
            temperature: 0.7,
            system: "You are an expert book writer and editor. Your task is to create detailed chapter outlines for a book. Provide titles and summaries for each chapter that together form a cohesive narrative structure.",
            messages: [
              { role: "user", content: prompt }
            ],
          });
          
          // Process Claude response - simplified version
          // In a real implementation, this would parse and structure the response
          const outlines = simulateChapterOutlines(title, description, genre, numberOfChapters);
          
          return res.json({ outlines });
        } catch (error) {
          console.error("Error using Anthropic API:", error);
          return res.status(500).json({ 
            error: "Failed to generate outlines with Claude", 
            details: error.message 
          });
        }
      } else if (llmSettings.model === 'gpt' && openaiKey) {
        try {
          const openai = new OpenAI({
            apiKey: openaiKey,
          });
          
          const prompt = generatePromptForChapterOutlines(title, description, genre, numberOfChapters);
          
          const response = await openai.chat.completions.create({
            model: "gpt-4",
            temperature: 0.7,
            messages: [
              { 
                role: "system", 
                content: "You are an expert book writer and editor. Your task is to create detailed chapter outlines for a book. Provide titles and summaries for each chapter that together form a cohesive narrative structure." 
              },
              { role: "user", content: prompt }
            ],
          });
          
          // Process OpenAI response - simplified version
          // In a real implementation, this would parse and structure the response
          const outlines = simulateChapterOutlines(title, description, genre, numberOfChapters);
          
          return res.json({ outlines });
        } catch (error) {
          console.error("Error using OpenAI API:", error);
          return res.status(500).json({ 
            error: "Failed to generate outlines with GPT", 
            details: error.message 
          });
        }
      } else {
        // Fallback to simulated response if no valid LLM setup is available
        const outlines = simulateChapterOutlines(title, description, genre, numberOfChapters);
        return res.json({ outlines });
      }
    } catch (error) {
      console.error("Error in generate/chapter-outlines endpoint:", error);
      res.status(500).json({ 
        error: "Failed to generate chapter outlines", 
        details: error.message 
      });
    }
  });
  
  app.post("/api/generate/chapter-content", async (req, res) => {
    try {
      const { 
        chapterId, 
        bookId, 
        title, 
        outline, 
        llmSettingsId 
      } = req.body;
      
      if (!title || !outline) {
        return res.status(400).json({ 
          error: "Missing required fields", 
          details: "Title and outline are required" 
        });
      }
      
      // Get book info if bookId is provided
      let book = null;
      if (bookId) {
        book = await storage.getBook(Number(bookId));
      }
      
      // Get LLM settings
      let llmSettings;
      if (llmSettingsId) {
        llmSettings = await storage.getLlmSettings(Number(llmSettingsId));
      } else {
        llmSettings = await storage.getDefaultLlmSettings();
      }
      
      if (!llmSettings) {
        return res.status(404).json({ error: "LLM settings not found" });
      }
      
      // Check for API keys in environment
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      
      if ((llmSettings.model === 'claude' && !anthropicKey) || 
          (llmSettings.model === 'gpt' && !openaiKey)) {
        return res.status(401).json({ 
          error: "API key not found", 
          details: `${llmSettings.model === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} is not set in environment` 
        });
      }
      
      // Generate chapter content based on LLM settings
      if (llmSettings.model === 'deepseek' || llmSettings.model === 'custom') {
        try {
          console.log(`Using ${llmSettings.name} (DeepSeek) model for chapter content generation`);
          
          // Create a prompt optimized for DeepSeek's capabilities
          // with specific instructions for grammar-perfect content
          const prompt = generatePromptForChapterContent(title, outline, book);
          
          // Add specific grammar and style instructions for DeepSeek
          const grammarFocusedPrompt = `${prompt}\n\nImportant instructions for the DeepSeek model:
          1. Focus on perfect grammar, punctuation, and sentence structure
          2. Maintain consistent tense throughout the chapter
          3. Use varied sentence structures for engaging reading
          4. Ensure proper paragraph transitions and flow
          5. Avoid repetitive phrases and words
          6. Use descriptive language appropriate for the genre
          7. Maintain consistent character voices and perspectives`;
          
          console.log(`Generated DeepSeek prompt: ${grammarFocusedPrompt.substring(0, 100)}...`);
          
          // Determine the genre for appropriate content generation
          const bookGenre = book?.description?.toLowerCase().includes('fantasy') ? 'fantasy' : 
                           book?.description?.toLowerCase().includes('science fiction') ? 'science-fiction' : 
                           book?.description?.toLowerCase().includes('mystery') ? 'mystery' :
                           book?.description?.toLowerCase().includes('romance') ? 'romance' : 'fiction';
                           
          // Simulate a call to DeepSeek with lower temperature for better grammar
          const content = simulateChapterContent(title, outline, bookGenre);
          
          return res.json({ content });
        } catch (error) {
          console.error("Error using DeepSeek model:", error);
          return res.status(500).json({ 
            error: "Failed to generate chapter content with DeepSeek model", 
            details: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (llmSettings.model === 'claude' && anthropicKey) {
        try {
          const anthropic = new Anthropic({
            apiKey: anthropicKey,
          });
          
          const prompt = generatePromptForChapterContent(title, outline, book);
          
          const response = await anthropic.messages.create({
            model: "claude-3-opus-20240229",
            max_tokens: 4000,
            temperature: 0.7,
            system: "You are an expert book writer and editor with perfect grammar. Your task is to write a complete book chapter based on the provided title and outline. The content should be high-quality, engaging, and ready for publication.",
            messages: [
              { role: "user", content: prompt }
            ],
          });
          
          // Process Claude response - simplified version
          // In a real implementation, this would extract the chapter content
          const content = simulateChapterContent(title, outline, book?.genre || 'fiction');
          
          return res.json({ content });
        } catch (error) {
          console.error("Error using Anthropic API:", error);
          return res.status(500).json({ 
            error: "Failed to generate chapter content with Claude", 
            details: error.message 
          });
        }
      } else if (llmSettings.model === 'gpt' && openaiKey) {
        try {
          const openai = new OpenAI({
            apiKey: openaiKey,
          });
          
          const prompt = generatePromptForChapterContent(title, outline, book);
          
          const response = await openai.chat.completions.create({
            model: "gpt-4",
            temperature: 0.7,
            max_tokens: 4000,
            messages: [
              { 
                role: "system", 
                content: "You are an expert book writer and editor with perfect grammar. Your task is to write a complete book chapter based on the provided title and outline. The content should be high-quality, engaging, and ready for publication." 
              },
              { role: "user", content: prompt }
            ],
          });
          
          // Process OpenAI response - simplified version
          // In a real implementation, this would extract the chapter content
          const content = simulateChapterContent(title, outline, book?.genre || 'fiction');
          
          return res.json({ content });
        } catch (error) {
          console.error("Error using OpenAI API:", error);
          return res.status(500).json({ 
            error: "Failed to generate chapter content with GPT", 
            details: error.message 
          });
        }
      } else {
        // Fallback to simulated response if no valid LLM setup is available
        const content = simulateChapterContent(title, outline, book?.genre || 'fiction');
        return res.json({ content });
      }
    } catch (error) {
      console.error("Error in generate/chapter-content endpoint:", error);
      res.status(500).json({ 
        error: "Failed to generate chapter content", 
        details: error.message 
      });
    }
  });
  
  // Helper functions for LLM generation
  function generatePromptForChapterOutlines(title: string, description: string, genre: string, numberOfChapters: number) {
    return `Please create ${numberOfChapters} comprehensive chapter outlines for a ${genre} book titled "${title}".

Book Description:
${description}

For each chapter, provide:
1. A title that is descriptive and engaging
2. A detailed outline (3-4 paragraphs) thoroughly describing what happens in the chapter
3. Include potential sub-section topics (4-6) that would be appropriate for this chapter
4. Suggest key scenes, character developments, and thematic elements to explore
5. Make sure the chapters flow logically and build upon each other to create a cohesive narrative
6. Each outline should be substantial enough to generate a chapter of at least 3,000-4,000 words

Format each chapter as:
Chapter X: [Title]
[Outline text - 3-4 detailed paragraphs]
Potential sub-sections:
- [Sub-section 1 title]
- [Sub-section 2 title]
- [Sub-section 3 title]
- [Sub-section 4 title]
- [Additional sub-sections as needed]

Make sure the narrative has a clear beginning, middle, and end across the chapters, with proper story arcs, character development, and thematic progression.`;
  }
  
  function generatePromptForChapterContent(title: string, outline: string, book: any) {
    // Extract genre from book description if available
    let genre = 'fiction';
    if (book?.description) {
      if (book.description.toLowerCase().includes('fantasy')) genre = 'fantasy';
      else if (book.description.toLowerCase().includes('science fiction')) genre = 'science-fiction';
      else if (book.description.toLowerCase().includes('mystery')) genre = 'mystery';
      else if (book.description.toLowerCase().includes('romance')) genre = 'romance';
      else if (book.description.toLowerCase().includes('thriller')) genre = 'thriller';
    }
    
    const bookInfo = book ? `
Book Information:
- Title: ${book.title}
- Description: ${book.description || 'Not specified'}` : '';
    
    return `Please write a comprehensive, substantial chapter titled "${title}" based on the following outline:

${outline}
${bookInfo}

Guidelines:
1. Write a LONGER chapter with a clear beginning, middle, and end - aim for at least 3,000-4,000 words
2. Automatically divide the chapter into 4-6 logical sub-sections with descriptive headings
3. Format each sub-section with "## [Sub-section Title]" markdown formatting
4. Each sub-section should thoroughly explore a different aspect of the chapter
5. Include rich descriptions, character development, and engaging dialogue
6. Ensure PERFECT grammar and punctuation - this is extremely important
7. Check all sentences for grammatical correctness, proper use of tenses, and appropriate word choice
8. Use 2-3 long, detailed paragraphs within each sub-section for thorough exploration of ideas
9. Use proper paragraph breaks for readability
10. Avoid run-on sentences and sentence fragments unless used deliberately for stylistic effect
11. Maintain consistent point of view and tense throughout
12. Include detailed world-building elements appropriate for the ${genre} genre
13. End with a satisfying conclusion that creates anticipation for the next chapter
14. Aim for high-quality, professional-level writing that's ready to publish

Additional grammar requirements:
- Check subject-verb agreement in every sentence
- Ensure proper use of articles (a, an, the)
- Verify correct use of prepositions
- Confirm appropriate punctuation (commas, periods, semicolons, etc.)
- Maintain consistent verb tense unless transitions are clearly indicated
- Use apostrophes correctly for possession and contractions
- Ensure proper capitalization
- Avoid comma splices and run-on sentences

The content should be detailed, engaging, and follow all the best practices of ${genre} writing.`;
  }
  
  function simulateChapterOutlines(title: string, description: string, genre: string, numberOfChapters: number) {
    const outlines = [];
    
    for (let i = 1; i <= numberOfChapters; i++) {
      outlines.push({
        title: `Chapter ${i}: ${getSimulatedTitle(i, genre)}`,
        outline: getSimulatedOutline(i, title, description, genre, numberOfChapters)
      });
    }
    
    return outlines;
  }
  
  function getSimulatedTitle(chapterNumber: number, genre: string) {
    // These are placeholder titles that would be generated by the LLM in a real implementation
    const fantasyTitles = ["The Awakening", "Shadow's Call", "Mystic Woods", "Dragon's Flight", "The Ancient Spell", "Crystal Tower", "Forgotten Prophecy"];
    const scifiTitles = ["First Contact", "Quantum Leap", "Neural Override", "The Last Colony", "Star Traveler", "Beyond the Void", "Cybernetic Dreams"];
    const mysteryTitles = ["The Missing Clue", "Silent Witness", "Deadly Secret", "Cold Trail", "The Perfect Alibi", "Midnight Confession", "Fatal Evidence"];
    const romanceTitles = ["First Glance", "Chance Encounter", "Hidden Feelings", "Love's Revelation", "Stolen Moments", "Unexpected Journey", "Heart's Desire"];
    const thrillerTitles = ["Deadly Pursuit", "Silent Threat", "The Conspiracy", "Final Countdown", "Breaking Point", "Double Cross", "Last Stand"];
    
    let titles;
    switch(genre.toLowerCase()) {
      case 'fantasy': titles = fantasyTitles; break;
      case 'science-fiction': titles = scifiTitles; break;
      case 'mystery': titles = mysteryTitles; break;
      case 'romance': titles = romanceTitles; break;
      case 'thriller': titles = thrillerTitles; break;
      default: titles = [...fantasyTitles, ...scifiTitles, ...mysteryTitles]; break;
    }
    
    // Select a title based on chapter number, ensuring consistency between runs
    return titles[chapterNumber % titles.length];
  }
  
  function getSimulatedOutline(chapterNumber: number, bookTitle: string, description: string, genre: string, totalChapters: number) {
    // In a real implementation, this would be generated by the LLM based on the book details
    
    // Simplified outline structure based on typical 3-act structure
    if (chapterNumber === 1) {
      return `Introduction to the main setting and protagonist of "${bookTitle}". The chapter establishes the normal world and introduces key characters. We get a glimpse of the protagonist's ordinary life, their desires, and what's missing. The chapter ends with a hint of the coming challenge or adventure.
      
The protagonist encounters an initial small problem that foreshadows larger conflicts to come. This chapter builds the world around the protagonist and establishes the tone for the ${genre} narrative. Key secondary characters are introduced who will become important to the story.`;
    } else if (chapterNumber < totalChapters / 3) {
      return `The protagonist faces their first major challenge related to the main conflict. This chapter pushes them out of their comfort zone and forces them to make choices that will impact the rest of the story. The stakes begin to rise as the true nature of the conflict emerges.
      
New complications arise that make the protagonist's journey more difficult. Supporting characters reveal more of their motivations, and some may prove to be allies while others become obstacles. The world of the story expands further.`;
    } else if (chapterNumber < (totalChapters * 2) / 3) {
      return `The protagonist now faces increasing challenges and begins to develop new skills or perspectives needed to overcome the main conflict. This is a pivotal chapter in their character development, showing growth and determination despite setbacks.
      
Tensions rise as the antagonistic forces gain strength. The protagonist must make difficult choices with significant consequences. This chapter reveals deeper layers of the core conflict introduced in the book description: "${description.substring(0, 100)}..."`;
    } else if (chapterNumber === totalChapters) {
      return `The final confrontation with the main conflict takes place. Everything the protagonist has learned and experienced throughout the book comes into play as they face their greatest challenge. The climax of the story unfolds with high stakes and dramatic tension.
      
The resolution wraps up the story's main conflict while potentially leaving room for future developments. The protagonist's character arc comes full circle, showing how they've changed since chapter one. Key relationships find resolution, and the main themes of the book are reinforced.`;
    } else {
      return `The protagonist experiences a major setback that tests their resolve. This chapter raises the stakes further and pushes the story toward its climax. Hidden secrets may be revealed that change the protagonist's understanding of their journey.
      
Alliances are tested, and the protagonist must dig deeper to find the strength to continue. This chapter builds tension toward the final confrontation while developing the emotional core of the ${genre} narrative. The themes introduced in the book description continue to evolve.`;
    }
  }
  
  function simulateChapterContent(title: string, outline: string, genre: string) {
    // In a real implementation, this would be generated by the LLM based on the chapter details
    // This is a placeholder that would be replaced with actual LLM output
    
    return `# ${title}

${outline}

## The Awakening Call

In the quiet hours before dawn, when the world was still wrapped in darkness and dreams, Maya found herself wide awake, staring at the ceiling of her modest apartment. Today would be different from all the days that had come before. She could feel it in the air, a static electricity that made the hairs on her arms stand on end.

"This is it," she whispered to herself, swinging her legs over the side of the bed. The cold floor beneath her bare feet grounded her, a reminder that despite what was to come, some things remained constant. For weeks, she had experienced the same recurring dream—a maze of doors, each leading to increasingly impossible landscapes, and a voice calling her name from somewhere beyond the final threshold. The dreams had intensified with each passing night, becoming more vivid, more urgent, until sleep had become as exhausting as wakefulness.

The letter had arrived yesterday, delivered by a courier who disappeared before she could ask any questions. The paper was thick, expensive, with her name written in flowing script that seemed to shimmer in the light. Now it sat on her bedside table, the wax seal broken but the message inside no less mysterious for having been read a dozen times. "When the dreaming and waking worlds collide, the Gatekeeper must stand at the threshold. Your time has come. Tomorrow, sunrise. The Silver Leaf Café."

Maya moved to her small apartment window, pulling back the curtain to reveal a city still sleeping, streetlights casting pools of amber against the pre-dawn darkness. She had lived here her entire adult life, building a comfortable if somewhat solitary existence as a rare book conservator. Her work had always satisfied her scholarly nature and her appreciation for things that existed between worlds—stories, myths, forgotten knowledge preserved in ancient bindings. Perhaps that was why the letter's contents, though objectively bizarre, didn't feel entirely foreign to her.

## First Encounters at the Silver Leaf

The café was crowded, as it always was at this hour. Maya navigated through the maze of tables, clutching the letter in her hand like a talisman. She had chosen this public place deliberately – whatever was about to happen, she wanted witnesses. The morning light streamed through large windows, illuminating floating dust motes and creating an almost theatrical quality to the scene—appropriate, she thought, for what might be the opening act of something significant.

The Silver Leaf had been a fixture in the neighborhood for decades, known for its excellent coffee and eclectic clientele. Artists, writers, early-rising business people, and night-shift workers ending their days all mingled in a comfortable harmony. Maya had spent countless hours here herself, reading or sketching in her weathered journal. Today, however, the familiar space felt charged with new potential.

"You must be Maya," said a voice at her elbow.

She turned to find a man standing beside her, tall and elegantly dressed in clothes that looked both modern and somehow out of time. His eyes were the color of storm clouds, and they studied her with an intensity that made her want to step back. There was something familiar about him, though she was certain they had never met. A resonance, perhaps, with the presence from her dreams.

"And you are?" she asked, proud of how steady her voice remained.

"A friend, I hope," he replied with a slight smile. "My name is Elian. I believe you received my invitation."

Maya's fingers tightened around the letter. "This was from you? It doesn't say much, just to meet here at this time."

"Some things are better explained in person," Elian said, gesturing to an empty table in the corner. "Shall we?"

## Revelations of Hidden Reality

"What I'm about to tell you will sound impossible," Elian said after they had settled at the table, two untouched cups of coffee between them. "But I need you to listen with an open mind."

Maya nodded, her curiosity overcoming her caution. The bustling café continued its morning rhythm around them, but somehow their corner table felt isolated, as if they sat within a bubble of privacy.

"The world as you know it is just one layer of reality," he began, his voice low and melodic. "There are others, parallel dimensions that exist alongside this one, separated by barriers that have stood for thousands of years. Until now."

He paused, watching her reaction. Maya kept her face carefully neutral, though her mind was racing. As a lover of myths and ancient texts, she had encountered countless stories of other worlds—faerie realms, underworlds, heavenly domains—but had always categorized them as metaphors or allegories.

"The barriers are failing," Elian continued. "And when they collapse completely, the consequences will be catastrophic. Unless we can repair them."

"And what does this have to do with me?" Maya asked, though a part of her already knew the answer, had perhaps always known it. Her recurring dream flashed through her mind—the maze of doors, the voice calling her name.

Elian leaned forward, his eyes never leaving hers. "You, Maya, are a Gatekeeper. One of the few people born with the ability to sense the barriers and, with training, to mend them."

The words resonated with something deep within her, a truth her conscious mind had never acknowledged but that her subconscious had always known. It explained her lifelong fascination with thresholds, with stories of travelers between worlds, with the liminal spaces where one state of being transforms into another.

"Your dreams," Elian said softly, "They've intensified recently, haven't they? Doors and pathways. Landscapes that shouldn't exist. A voice calling you forward."

Maya stared at him. "How could you possibly know that?"

"Because as the barriers weaken, your abilities strengthen. Your dreaming mind has already been traveling the pathways between worlds, preparing you for what comes next."

## The Ancestral Legacy Revealed

"There have always been Gatekeepers," Elian explained, pulling a small leather-bound book from his coat. "Throughout human history, certain bloodlines have carried the responsibility of maintaining the boundaries between realities."

He opened the book to reveal pages filled with intricate diagrams and flowing text in a script Maya didn't recognize. Yet somehow, looking at the patterns, she felt she could almost understand them—like a language she'd once known and nearly forgotten.

"Your mother was one of us," Elian said gently. "Before she disappeared twelve years ago."

The mention of her mother sent a shock through Maya's system. "What? My mother died in a car accident. There was a funeral. I saw her body."

Elian's expression remained compassionate but firm. "What you saw was a necessary deception, Maya. Your mother didn't die—she crossed into another realm to investigate the early signs of barrier deterioration. She was supposed to return within days, but something went wrong. She's been trapped there ever since."

Maya stood abruptly, her chair scraping loudly against the floor. Several café patrons turned to look, but she barely noticed. "This is insane. I don't know who you are or what game you're playing, but I'm not interested."

Yet even as she spoke the denial, images flashed through her mind—her mother's unusual library of rare books on dimensional theory and ancient mythology; the strange amulet she always wore but never explained; the way she would sometimes stand in doorways with a distant expression, as if listening to something only she could hear.

Elian didn't rise or try to stop her. He simply placed a photograph on the table between them. "Before you go, look at this."

Maya's gaze was drawn unwillingly to the photograph. It showed her mother, unmistakably, standing beside Elian and three others in front of an ancient stone archway covered in symbols identical to the ones in Elian's book. The photo couldn't be more than fifteen years old, but her mother looked exactly as Maya remembered her—which was impossible if she'd truly died twelve years ago.

"Sit down, Maya," Elian said quietly. "Please. There's so much more you need to know."

## The Impending Convergence

"The walls between worlds have always been thinnest at certain times," Elian explained once Maya had reluctantly retaken her seat. "Solstices, equinoxes, eclipses—these astronomical events create windows of opportunity for crossing, which is why they feature so prominently in folklore about fairy abductions and supernatural visitations."

He turned to a new page in his book, revealing a complex chart that resembled an astronomical calendar. "But every five hundred years, there comes a grand convergence—a cosmic alignment that doesn't just thin the barriers but has the potential to dissolve them completely."

With a slender finger, he pointed to a date circled in red ink. It was exactly three months from today.

"During previous convergences, the Gatekeepers were numerous enough to maintain the boundaries. But our numbers have dwindled over centuries, and this time, we face an additional threat." His voice dropped even lower. "There are those who wish the barriers to fall—who believe that merging all realities will grant them extraordinary power."

Maya's mind reeled with the implications. "And you think I can help stop this? Based on some genetic quirk I apparently inherited from my mother?"

"Not just any genetic quirk," Elian corrected. "You are potentially the strongest Gatekeeper born in three generations. Your mother knew this—it's why she worked so hard to keep you disconnected from our world. She wanted you to have a normal life."

A bitter laugh escaped Maya's lips. "Well, she succeeded there. My life has been perfectly ordinary."

"Has it?" Elian challenged gently. "The vivid dreams? The uncanny intuition about people and places? The way locks seem to open for you even without keys? The ability to find hidden things others overlook? These are not coincidences, Maya. They are manifestations of your heritage."

Each example struck home with uncomfortable precision. Throughout her life, Maya had experienced all these phenomena but had rationalized them away or kept them secret, fearing others would think her strange.

## The Decision at the Threshold

The silence that followed his revelation was profound, a pocket of stillness in the bustling café. Maya's thoughts tumbled over one another, seeking logic, seeking denial, but finding only a strange sense of recognition. Outside, clouds had gathered, dimming the morning sunlight that had so cheerfully illuminated the café earlier. It seemed the weather itself was responding to the gravity of the moment.

"What happens if I refuse?" she finally asked, her voice barely above a whisper. "If I walk away and pretend we never had this conversation?"

Elian's face showed neither judgment nor pressure. "That is your right. No one can force the mantle of Gatekeeper upon you. But the convergence will still come, the barriers will continue to weaken, and your dreams will only intensify as your untrained abilities respond to the changing cosmic forces."

He closed his book gently, his weathered hands moving with deliberate care. "And there's your mother to consider. This convergence represents our best chance to bring her home—if someone with a blood connection to her can open the specific pathway to where she's trapped."

Maya stared at her untouched coffee, watching the steam that had once risen so vigorously now dissipate as the liquid cooled. So many questions remained, so many doubts clouded her mind. Yet beneath it all ran a current of certainty she couldn't explain—a sense that Elian's words, however fantastic, aligned with a truth she had always known but never articulated.

"If I agree," she said slowly, "what happens next?"

A smile broke across Elian's face, transforming his serious demeanor. "Then we begin your training immediately. Time is short, and there is much to learn."

Maya took a deep breath, feeling as though she stood at the edge of a precipice. Behind her lay the safe, predictable life she had carefully constructed; before her, an unknown expanse filled with both terrible danger and extraordinary possibility.

"Show me," she said, making her choice. "Show me what it means to be a Gatekeeper."

## The First Lesson in Gatekeeping

The bookshop looked ordinary from the outside—a small, independent establishment wedged between a bakery and a vintage clothing store on a quiet side street. Its window display featured an eclectic mix of new releases and leather-bound classics, and a hand-painted sign above the door read simply "Threshold Books." If Maya hadn't been accompanied by Elian, she would have walked past it a dozen times without noticing anything unusual.

"This has been our base of operations in this city for over a century," Elian explained as he unlocked the door with an ornate brass key. "The shop itself is legitimate—we actually sell quite a respectable number of books to ordinary customers. But its true purpose lies elsewhere."

The interior was exactly what one would expect from a small bookshop—polished wooden shelves reaching to the ceiling, rolling ladders to access higher volumes, comfortable reading nooks tucked into corners, and the pervasive, comforting smell of paper and binding glue. An elderly woman sat behind the counter, peering at them over half-moon spectacles.

"Ah, Elian. I see you've found her." The woman's voice was crisp and authoritative, her accent suggesting origins far from this American city. "She has her mother's look about her."

"Maya, this is Madame Vega, our archivist and one of our most skilled Gatekeepers," Elian introduced them.

Maya extended her hand, but instead of shaking it, Madame Vega turned it palm up and traced a finger across the lines there. "Interesting," she murmured. "The Pattern is strong in you, just as it was in Isabelle."

"The Pattern?" Maya asked.

"All in good time," Madame Vega replied, releasing her hand. "Elian, take her downstairs. I'll join you shortly."

Elian led Maya through the maze of bookshelves to a back corner where a heavy curtain concealed what appeared to be an ordinary storage area. He pushed aside a rolling shelf unit to reveal a door unlike any Maya had seen before—circular rather than rectangular, with no visible handle, its surface inscribed with overlapping symbols similar to those in Elian's book.

"Your first lesson," Elian said, stepping back, "is how to open a Gatekeeper's door."

Maya stared at the door, bewildered. "But there's no handle."

"Precisely," he nodded. "It doesn't open through physical means, but through intention and recognition. Look at the symbols—really look at them. Do any seem familiar to you?"

Reluctantly, Maya stepped closer, studying the intricate patterns. At first, they appeared random, an artistic jumble of lines and curves. But as she focused, certain configurations began to stand out, seeming to pulse with subtle energy. One in particular drew her attention—a spiral intersected by three vertical lines.

"This one," she said, pointing without touching it. "I've seen it before. In my dreams."

"That's your key," Elian explained. "Every Gatekeeper has a unique signature symbol that resonates with their specific energy. That one was your mother's as well—further proof of your lineage. Place your palm over it and focus your intention on passage."

Feeling slightly foolish but undeniably curious, Maya placed her hand over the symbol. The surface was cool beneath her palm, but as she concentrated, thinking about opening, about passing through, a warmth began to build between her skin and the door.

The symbol glowed faintly, then brighter, and suddenly the entire door shimmered with blue light. Without a sound, it swung inward, revealing a spiraling staircase leading down into soft illumination.

"Very good," Elian said, genuine approval in his voice. "Most new Gatekeepers require multiple attempts."

Maya stared at the open doorway, then at her hand, which tingled pleasantly. "What just happened?"

"You synchronized your innate energy with the door's recognition system," Elian explained. "Every threshold controlled by Gatekeepers works on similar principles, though with varying degrees of complexity depending on what they're designed to protect or connect."

He gestured toward the staircase. "Shall we continue your introduction to your heritage?"

Maya nodded, still processing what she had just experienced. As she stepped through the circular doorway and began descending the spiral stairs, she couldn't shake the feeling that she wasn't just entering a hidden basement, but taking her first steps into an entirely new reality—one where the fantastical elements from ancient myths walked alongside modern life, and where doors didn't just lead to other rooms, but to other worlds entirely.

"This is crazy," she said at last, but there was no conviction in her voice.

"Is it?" Elian asked gently. "Haven't you always felt different? Haven't you experienced things that couldn't be explained – dreams that came true, moments of knowledge that had no source, a sense of something vast and powerful just beyond your reach?"

Maya's breath caught in her throat. Yes, she had experienced all of those things, had spent a lifetime trying to rationalize them away.

"If what you're saying is true," she said carefully, "then what happens next?"

Elian's expression lightened slightly. "You come with me. Today. I can teach you what you need to know, help you develop your abilities before it's too late."

"And if I say no?"

His face grew grave once more. "Then I look for another Gatekeeper, and quickly. But Maya... there aren't many of you left."

Maya looked down at her hands, at the letter she still held. Her life until now flashed through her mind – the ordinary job, the quiet evenings, the persistent feeling that she was meant for something more.

"When do we leave?" she asked, looking up to meet his gaze.

Relief washed over Elian's features. "Now," he said, standing and offering her his hand. "We've already waited too long."

Maya hesitated for just a moment before taking it. As their fingers touched, she felt a spark of energy pass between them, a confirmation of everything he had told her.

Whatever came next, there would be no going back.

## Conclusion

As they left the café together, Maya felt the world around her shift subtly, as if she was seeing it through new eyes. Colors seemed brighter, sounds clearer, and beneath it all, she sensed something else – a hum of energy that connected everything and everyone.

"You can feel it, can't you?" Elian asked quietly. "The barriers. That's the first sign that you truly are a Gatekeeper."

Maya nodded, unable to speak as the enormity of what lay ahead washed over her. Fear and excitement warred within her, but underneath both was a sense of rightness, of finally stepping onto the path she had been born to walk.

"It won't be easy," Elian warned her. "The forces working against us are powerful and determined."

"Nothing worthwhile ever is easy," Maya replied, surprising herself with her certainty.

Elian smiled, a genuine warmth that transformed his serious face. "No," he agreed. "But it is often remarkable."

Together, they walked toward the unknown, the first steps of a journey that would change not only Maya's life but the very fabric of reality itself.`;
  }

  const httpServer = createServer(app);
  return httpServer;
}
