import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { Book, Chapter } from '@shared/schema';
import { storage } from './storage';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import * as htmlPdf from 'html-pdf';

/**
 * Export a book to DOCX format
 */
export async function exportToDocx(bookId: number): Promise<Buffer> {
  // Get book and all chapters
  const book = await storage.getBook(bookId);
  if (!book) {
    throw new Error("Book not found");
  }
  
  const chapters = await storage.getChapters(bookId);
  
  // Create document
  const doc = new Document({
    title: book.title,
    description: book.description || '',
    creator: "DeepWriter AI",
  });
  
  // Add title and description
  doc.addSection({
    children: [
      new Paragraph({
        text: book.title,
        heading: HeadingLevel.TITLE,
      }),
      new Paragraph({
        text: book.description || '',
        spacing: {
          after: 200,
        },
      }),
    ],
  });
  
  // Add chapters
  chapters.sort((a, b) => a.orderIndex - b.orderIndex).forEach((chapter) => {
    // Parse markdown content and convert to docx format
    const content = chapter.content || '';
    const lines = content.split('\n');
    
    const paragraphs: Paragraph[] = [];
    
    // Add chapter title
    paragraphs.push(
      new Paragraph({
        text: chapter.title,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
      })
    );
    
    let currentHeadingLevel = 0;
    
    // Process each line
    for (const line of lines) {
      // Skip the title line if it matches chapter title
      if (line.startsWith('# ') && line.includes(chapter.title)) {
        continue;
      }
      
      // Handle headings
      if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace('## ', ''),
            heading: HeadingLevel.HEADING_2,
            spacing: {
              before: 200,
              after: 120,
            },
          })
        );
        currentHeadingLevel = 2;
        continue;
      }
      
      if (line.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace('### ', ''),
            heading: HeadingLevel.HEADING_3,
            spacing: {
              before: 160,
              after: 80,
            },
          })
        );
        currentHeadingLevel = 3;
        continue;
      }
      
      // Skip empty lines
      if (line.trim() === '') {
        continue;
      }
      
      // Normal text
      paragraphs.push(
        new Paragraph({
          text: line,
          spacing: {
            before: 80,
            after: 80,
          },
        })
      );
    }
    
    // Add all paragraphs to the document
    doc.addSection({
      children: paragraphs,
    });
  });
  
  // Generate docx file
  return await Packer.toBuffer(doc);
}

/**
 * Export a book to HTML format
 */
export function exportToHtml(book: Book, chapters: Chapter[]): string {
  // Sort chapters by order
  chapters.sort((a, b) => a.orderIndex - b.orderIndex);
  
  // Start HTML document
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${book.title}</title>
  <style>
    body { 
      font-family: 'Georgia', serif; 
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    h1 { font-size: 2.5rem; margin-top: 3rem; }
    h2 { font-size: 1.8rem; margin-top: 2rem; }
    h3 { font-size: 1.4rem; margin-top: 1.5rem; }
    p { margin-top: 1rem; text-align: justify; }
    .book-title { font-size: 3rem; text-align: center; margin-bottom: 0.5rem; }
    .book-description { 
      font-style: italic; 
      text-align: center;
      margin-bottom: 4rem;
      font-size: 1.2rem;
      color: #555;
    }
    .chapter { margin-top: 4rem; page-break-before: always; }
    .chapter:first-of-type { page-break-before: avoid; }
  </style>
</head>
<body>
  <div class="book-title">${book.title}</div>
  <div class="book-description">${book.description || ''}</div>
`;

  // Add each chapter
  chapters.forEach((chapter) => {
    html += `<div class="chapter">`;
    
    // Process chapter content
    let content = chapter.content || '';
    
    // Replace markdown headings with HTML headings
    content = content.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    content = content.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    content = content.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    
    // Replace double newlines with paragraph breaks
    content = content.replace(/\n\n/g, '</p><p>');
    
    // Wrap content in paragraphs if not already done
    if (!content.startsWith('<')) {
      content = '<p>' + content + '</p>';
    }
    
    html += content;
    html += `</div>`;
  });
  
  // Close HTML document
  html += `
</body>
</html>`;

  return html;
}

/**
 * Export a book to PDF format
 */
export async function exportToPdf(bookId: number): Promise<Buffer> {
  // Get book and all chapters
  const book = await storage.getBook(bookId);
  if (!book) {
    throw new Error("Book not found");
  }
  
  const chapters = await storage.getChapters(bookId);
  
  // Generate HTML content
  const html = exportToHtml(book, chapters);
  
  // Convert HTML to PDF
  return new Promise((resolve, reject) => {
    const options = { 
      format: 'Letter',
      border: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    };
    
    htmlPdf.create(html, options).toBuffer((err, buffer) => {
      if (err) {
        reject(err);
      } else {
        resolve(buffer);
      }
    });
  });
}

/**
 * Export a book to plain text format
 */
export async function exportToText(bookId: number): Promise<string> {
  // Get book and all chapters
  const book = await storage.getBook(bookId);
  if (!book) {
    throw new Error("Book not found");
  }
  
  const chapters = await storage.getChapters(bookId);
  chapters.sort((a, b) => a.orderIndex - b.orderIndex);
  
  // Build text content
  let text = `${book.title}\n\n`;
  if (book.description) {
    text += `${book.description}\n\n`;
  }
  
  text += `=".repeat(80)\n\n`;
  
  // Add chapters
  chapters.forEach((chapter) => {
    text += `${chapter.title}\n\n`;
    
    // Process chapter content (remove markdown formatting)
    let content = chapter.content || '';
    
    // Remove markdown headings
    content = content.replace(/^# .*$/gm, '');
    content = content.replace(/^## (.*?)$/gm, '$1\n');
    content = content.replace(/^### (.*?)$/gm, '$1\n');
    
    text += `${content}\n\n`;
    text += `=`.repeat(80) + `\n\n`;
  });
  
  return text;
}