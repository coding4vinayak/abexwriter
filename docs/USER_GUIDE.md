# AI Book Generator - User Guide

Welcome to AI Book Generator, a powerful tool designed to help you create books with AI assistance. This guide will walk you through all the features and functionalities of the application.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Managing Book Projects](#managing-book-projects)
4. [Working with Chapters](#working-with-chapters)
5. [Using AI Features](#using-ai-features)
6. [Settings Configuration](#settings-configuration)
7. [Tips and Tricks](#tips-and-tricks)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### Accessing the Application

AI Book Generator is a web application that can be accessed through your browser. After installation, the application will be available at:

```
http://localhost:5000
```

### First-time Setup

1. When you first open the application, you'll see the Dashboard page
2. Navigate to the Settings page to configure your LLM (Language Model) settings
3. Add your API keys for the AI models you plan to use
4. Configure your auto-edit preferences

## Dashboard Overview

The Dashboard is your central hub for monitoring your writing progress and accessing recent projects.

### Key Elements

- **Quick Stats**: View the total number of books, chapters, and words you've written
- **Recent Projects**: Access your most recently updated books
- **Quick Actions**: Create a new book or access commonly used features

## Managing Book Projects

### Creating a New Book

1. From the Dashboard or Projects page, click the "New Book" button
2. Enter a title for your book (required)
3. Add a description (optional)
4. Click "Create Book"

### Viewing and Managing Books

1. Navigate to the Projects page to see all your books
2. Each book card displays:
   - Title
   - Description
   - Last updated date
   - Status (draft, in-progress, review, etc.)
   - Chapter count
   - Word count
3. Click on a book card to open the Editor view for that book

### Deleting a Book

1. On the Projects page, hover over a book card
2. Click the "Delete" button (trash icon)
3. Confirm the deletion in the dialog

## Working with Chapters

### Adding Chapters

There are three ways to add chapters to your book:

1. **Manual Creation**:
   - In the Editor view, click "Add Chapter" in the sidebar
   - Enter a title for the chapter
   - Click "Create Chapter"

2. **AI Generation**:
   - In the Editor view, click "AI Generate" in the chapters section
   - The AI will suggest multiple chapters based on your book outline
   - Select the chapters you want to include
   - Click "Add X Chapters"

3. **From Projects Page**:
   - On the Projects page, click "New Chapter"
   - Select a book from the dropdown
   - Enter a title for the chapter
   - Optionally add an outline
   - Click "Create Chapter"

### Organizing Chapters

1. In the Editor view, chapters are listed in the sidebar
2. You can reorder chapters by clicking "Reorder" and dragging them to a new position
3. Chapter numbers are automatically updated based on their order

### Editing Chapter Content

1. Click on a chapter in the sidebar to open it in the editor
2. The editor provides basic formatting tools:
   - Text formatting (paragraph, headings, etc.)
   - Quotes
   - Lists
3. Changes are saved automatically when you click the "Save" button

## Using AI Features

AI Book Generator offers several AI-powered features to assist with your writing process:

### Generating Book Outlines

1. In the Editor view, click "Edit Outline" in the sidebar
2. Click "Generate Outline" in the dialog
3. The AI will create a book outline based on the title
4. You can edit the generated outline
5. Click "Save Outline" to apply it to your book

### Generating Chapter Structure

1. In the Editor view, click "AI Generate" in the chapters section
2. The AI will analyze your book title and outline
3. It will suggest a list of chapters with titles and brief outlines
4. Select the chapters you want to include
5. Click "Add X Chapters" to create them

### Generating Chapter Content

1. Open a chapter in the editor
2. Click "AI Assist" in the toolbar
3. The AI will:
   - Parse any existing outline in the chapter
   - Extract potential headings
   - Create a structured content framework with sections
   - Generate placeholder text under each heading
4. Review and edit the generated content
5. Click "Save" to save your changes

### Auto-Editing

1. After writing or generating content, click "Auto-Edit" in the toolbar
2. The AI will analyze your writing and make improvements based on your settings:
   - Grammar and spelling corrections
   - Style consistency adjustments
   - Content improvements
   - (Optional) Plagiarism checks
3. Review the changes and save

## Settings Configuration

### LLM Settings

Configure your AI model preferences:

1. Navigate to the Settings page
2. In the "LLM Settings" section, you can:
   - Add new model configurations
   - Set default models
   - Configure model parameters (temperature, max tokens, etc.)
   - Add API keys

### Auto-Edit Settings

Customize how the auto-edit feature works:

1. Navigate to the Settings page
2. In the "Auto-Edit Settings" section, toggle:
   - Grammar Check: Fix grammar and spelling issues
   - Style Consistency: Maintain consistent writing style
   - Content Improvement: Enhance the quality of content
   - Plagiarism Check: Check for unoriginal content

### Database Settings

If you're using a PostgreSQL database:

1. Navigate to the Settings page
2. In the "Database Settings" section, configure:
   - Database connection details
   - Credentials
   - Schema preferences

## Tips and Tricks

### For Efficient Book Writing

1. **Start with a Solid Outline**: Create a comprehensive outline before generating chapters
2. **Use AI for Inspiration**: Generate multiple chapter outlines and select the best ones
3. **Edit AI Content**: Always review and edit AI-generated content for quality and consistency
4. **Save Frequently**: Click the "Save" button regularly to prevent losing work
5. **Track Word Count**: Use the word count statistics to track your progress

### For Better AI Results

1. **Be Specific**: Provide detailed book outlines for better chapter suggestions
2. **Iterate**: Generate multiple versions and select the best elements
3. **Structure Your Outlines**: Use bullet points or numbering in your outlines for better parsing
4. **Adjust Model Settings**: Experiment with different temperature settings for varied results

## Troubleshooting

### Common Issues

1. **Content Not Saving**:
   - Check that you've clicked the "Save" button
   - Verify your database connection (if using PostgreSQL)

2. **AI Generation Not Working**:
   - Check your API keys in the LLM Settings
   - Verify your internet connection
   - Try decreasing the max tokens if responses are timing out

3. **Missing Chapters**:
   - Check if you're viewing the correct book
   - Verify that the chapters were successfully created

4. **Performance Issues**:
   - Consider using in-memory storage for faster development
   - Optimize database settings for production use

### Getting Help

If you encounter issues not covered in this guide, please:
1. Check the project README for additional information
2. Consult the API documentation for integration details
3. Review the technical architecture documentation for system insights