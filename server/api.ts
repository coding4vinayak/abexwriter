import express, { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { insertBookSchema, insertChapterSchema, books, chapters } from '@shared/schema';
import { z } from 'zod';
import { log } from './vite';

/**
 * API Router for remote access to the application
 * These endpoints can be used to programmatically create and manage books/chapters
 */
export function setupApiRouter() {
  const router = express.Router();

  // Middleware to handle API errors
  const apiErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    log(`API Error: ${err.message}`, 'api');
    
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.errors
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  };

  // Authentication middleware for API access
  // This is a simple implementation - in production, use API keys or JWT tokens
  const apiAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // For now, we'll use a simple API key check
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Unauthorized. Invalid or missing API key.' });
    }
    
    // For simplicity, we'll use a fixed user ID for API requests
    // In production, the API key should be linked to a specific user
    req.body.userId = 1;  // Default API user
    
    next();
  };

  // Apply middleware
  router.use(apiAuthMiddleware);
  router.use(express.json());

  // API Status endpoint
  router.get('/status', (req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // Books API endpoints
  router.get('/books', async (req, res, next) => {
    try {
      const userId = req.body.userId;
      const books = await storage.getBooks(userId);
      res.json(books);
    } catch (error) {
      next(error);
    }
  });

  router.post('/books', async (req, res, next) => {
    try {
      const bookData = insertBookSchema.parse(req.body);
      const newBook = await storage.createBook(bookData);
      res.status(201).json(newBook);
    } catch (error) {
      next(error);
    }
  });

  router.get('/books/:id', async (req, res, next) => {
    try {
      const bookId = Number(req.params.id);
      const book = await storage.getBook(bookId);
      
      if (!book) {
        return res.status(404).json({ error: 'Book not found' });
      }
      
      res.json(book);
    } catch (error) {
      next(error);
    }
  });

  router.put('/books/:id', async (req, res, next) => {
    try {
      const bookId = Number(req.params.id);
      const bookData = req.body;
      const updatedBook = await storage.updateBook(bookId, bookData);
      
      if (!updatedBook) {
        return res.status(404).json({ error: 'Book not found' });
      }
      
      res.json(updatedBook);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/books/:id', async (req, res, next) => {
    try {
      const bookId = Number(req.params.id);
      const success = await storage.deleteBook(bookId);
      
      if (!success) {
        return res.status(404).json({ error: 'Book not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Chapters API endpoints
  router.get('/books/:bookId/chapters', async (req, res, next) => {
    try {
      const bookId = Number(req.params.bookId);
      const chapters = await storage.getChapters(bookId);
      res.json(chapters);
    } catch (error) {
      next(error);
    }
  });

  router.post('/books/:bookId/chapters', async (req, res, next) => {
    try {
      const bookId = Number(req.params.bookId);
      const chapterData = {
        ...req.body,
        bookId
      };
      
      const validatedData = insertChapterSchema.parse(chapterData);
      const newChapter = await storage.createChapter(validatedData);
      res.status(201).json(newChapter);
    } catch (error) {
      next(error);
    }
  });

  router.get('/chapters/:id', async (req, res, next) => {
    try {
      const chapterId = Number(req.params.id);
      const chapter = await storage.getChapter(chapterId);
      
      if (!chapter) {
        return res.status(404).json({ error: 'Chapter not found' });
      }
      
      res.json(chapter);
    } catch (error) {
      next(error);
    }
  });

  router.put('/chapters/:id', async (req, res, next) => {
    try {
      const chapterId = Number(req.params.id);
      const chapterData = req.body;
      const updatedChapter = await storage.updateChapter(chapterId, chapterData);
      
      if (!updatedChapter) {
        return res.status(404).json({ error: 'Chapter not found' });
      }
      
      res.json(updatedChapter);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/chapters/:id', async (req, res, next) => {
    try {
      const chapterId = Number(req.params.id);
      const success = await storage.deleteChapter(chapterId);
      
      if (!success) {
        return res.status(404).json({ error: 'Chapter not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Stats API endpoints
  router.get('/stats', async (req, res, next) => {
    try {
      const userId = req.body.userId;
      const stats = await storage.getBookStats(userId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Apply error handler middleware after all routes
  router.use(apiErrorHandler);

  return router;
}