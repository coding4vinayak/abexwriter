# API Documentation

This document provides details about the API endpoints available in the AI Book Generator application.

## Base URL

By default, the API is available at the same URL as the frontend application, with endpoints prefixed with `/api`.

## Authentication

Currently, the application uses a temporary user ID (TEMP_USER_ID = 1) for all operations. Future versions will implement proper authentication.

## Endpoints

### Books

#### Get All Books

```
GET /api/books?userId={userId}
```

**Parameters:**
- `userId` (required): ID of the user to fetch books for

**Response:**
```json
[
  {
    "id": 1,
    "title": "My Book Title",
    "description": "Book description",
    "outline": "Book outline",
    "status": "draft",
    "userId": 1,
    "llmSettingsId": 1,
    "wordCount": 0,
    "chapterCount": 0,
    "createdAt": "2025-05-15T07:44:58.497Z",
    "updatedAt": "2025-05-15T07:44:58.497Z"
  }
]
```

#### Get Recent Books

```
GET /api/books/recent?userId={userId}&limit={limit}
```

**Parameters:**
- `userId` (required): ID of the user to fetch books for
- `limit` (optional): Maximum number of books to return (default: 5)

**Response:**
```json
[
  {
    "id": 1,
    "title": "My Book Title",
    "description": "Book description",
    "outline": "Book outline",
    "status": "draft",
    "userId": 1,
    "llmSettingsId": 1,
    "wordCount": 0,
    "chapterCount": 0,
    "createdAt": "2025-05-15T07:44:58.497Z",
    "updatedAt": "2025-05-15T07:44:58.497Z"
  }
]
```

#### Get Book by ID

```
GET /api/books/{id}
```

**Parameters:**
- `id` (required): ID of the book to fetch

**Response:**
```json
{
  "id": 1,
  "title": "My Book Title",
  "description": "Book description",
  "outline": "Book outline",
  "status": "draft",
  "userId": 1,
  "llmSettingsId": 1,
  "wordCount": 0,
  "chapterCount": 0,
  "createdAt": "2025-05-15T07:44:58.497Z",
  "updatedAt": "2025-05-15T07:44:58.497Z"
}
```

#### Create Book

```
POST /api/books
```

**Request Body:**
```json
{
  "title": "My Book Title",
  "description": "Book description",
  "userId": 1,
  "status": "draft"
}
```

**Response:**
```json
{
  "id": 1,
  "title": "My Book Title",
  "description": "Book description",
  "outline": null,
  "status": "draft",
  "userId": 1,
  "llmSettingsId": null,
  "wordCount": 0,
  "chapterCount": 0,
  "createdAt": "2025-05-15T07:44:58.497Z",
  "updatedAt": "2025-05-15T07:44:58.497Z"
}
```

#### Update Book

```
PUT /api/books/{id}
```

**Parameters:**
- `id` (required): ID of the book to update

**Request Body:**
```json
{
  "title": "Updated Book Title",
  "description": "Updated description",
  "outline": "Updated outline",
  "status": "in-progress"
}
```

**Response:**
```json
{
  "id": 1,
  "title": "Updated Book Title",
  "description": "Updated description",
  "outline": "Updated outline",
  "status": "in-progress",
  "userId": 1,
  "llmSettingsId": null,
  "wordCount": 0,
  "chapterCount": 0,
  "createdAt": "2025-05-15T07:44:58.497Z",
  "updatedAt": "2025-05-15T07:45:30.123Z"
}
```

#### Delete Book

```
DELETE /api/books/{id}
```

**Parameters:**
- `id` (required): ID of the book to delete

**Response:**
- Status Code: 204 No Content

### Chapters

#### Get All Chapters for a Book

```
GET /api/books/{bookId}/chapters
```

**Parameters:**
- `bookId` (required): ID of the book to fetch chapters for

**Response:**
```json
[
  {
    "id": 1,
    "title": "Chapter 1",
    "content": "Chapter content",
    "outline": "Chapter outline",
    "status": "outline",
    "orderIndex": 0,
    "bookId": 1,
    "wordCount": 0,
    "createdAt": "2025-05-15T07:45:05.000Z",
    "updatedAt": "2025-05-15T07:45:05.000Z"
  }
]
```

#### Get Chapter by ID

```
GET /api/chapters/{id}
```

**Parameters:**
- `id` (required): ID of the chapter to fetch

**Response:**
```json
{
  "id": 1,
  "title": "Chapter 1",
  "content": "Chapter content",
  "outline": "Chapter outline",
  "status": "outline",
  "orderIndex": 0,
  "bookId": 1,
  "wordCount": 0,
  "createdAt": "2025-05-15T07:45:05.000Z",
  "updatedAt": "2025-05-15T07:45:05.000Z"
}
```

#### Create Chapter

```
POST /api/chapters
```

**Request Body:**
```json
{
  "title": "Chapter 1",
  "outline": "Chapter outline",
  "bookId": 1,
  "status": "outline",
  "orderIndex": 0
}
```

**Response:**
```json
{
  "id": 1,
  "title": "Chapter 1",
  "content": null,
  "outline": "Chapter outline",
  "status": "outline",
  "orderIndex": 0,
  "bookId": 1,
  "wordCount": 0,
  "createdAt": "2025-05-15T07:45:05.000Z",
  "updatedAt": "2025-05-15T07:45:05.000Z"
}
```

#### Update Chapter

```
PUT /api/chapters/{id}
```

**Parameters:**
- `id` (required): ID of the chapter to update

**Request Body:**
```json
{
  "title": "Updated Chapter Title",
  "content": "Updated content",
  "outline": "Updated outline",
  "status": "in-progress"
}
```

**Response:**
```json
{
  "id": 1,
  "title": "Updated Chapter Title",
  "content": "Updated content",
  "outline": "Updated outline",
  "status": "in-progress",
  "orderIndex": 0,
  "bookId": 1,
  "wordCount": 12,
  "createdAt": "2025-05-15T07:45:05.000Z",
  "updatedAt": "2025-05-15T07:46:10.123Z"
}
```

#### Delete Chapter

```
DELETE /api/chapters/{id}
```

**Parameters:**
- `id` (required): ID of the chapter to delete

**Response:**
- Status Code: 204 No Content

### LLM Settings

#### Get All LLM Settings

```
GET /api/llm-settings
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "novideep",
    "model": "custom",
    "temperature": 0.7,
    "maxTokens": 2000,
    "apiKey": "sk-...",
    "apiEndpoint": "https://api.example.com",
    "isDefault": true,
    "createdAt": "2025-05-15T07:30:00.000Z",
    "updatedAt": "2025-05-15T07:30:00.000Z"
  }
]
```

#### Get Default LLM Settings

```
GET /api/llm-settings/default
```

**Response:**
```json
{
  "id": 1,
  "name": "novideep",
  "model": "custom",
  "temperature": 0.7,
  "maxTokens": 2000,
  "apiKey": "sk-...",
  "apiEndpoint": "https://api.example.com",
  "isDefault": true,
  "createdAt": "2025-05-15T07:30:00.000Z",
  "updatedAt": "2025-05-15T07:30:00.000Z"
}
```

#### Get LLM Settings by ID

```
GET /api/llm-settings/{id}
```

**Parameters:**
- `id` (required): ID of the LLM settings to fetch

**Response:**
```json
{
  "id": 1,
  "name": "novideep",
  "model": "custom",
  "temperature": 0.7,
  "maxTokens": 2000,
  "apiKey": "sk-...",
  "apiEndpoint": "https://api.example.com",
  "isDefault": true,
  "createdAt": "2025-05-15T07:30:00.000Z",
  "updatedAt": "2025-05-15T07:30:00.000Z"
}
```

#### Create LLM Settings

```
POST /api/llm-settings
```

**Request Body:**
```json
{
  "name": "ChatGPT",
  "model": "gpt-4o",
  "temperature": 0.8,
  "maxTokens": 4000,
  "apiKey": "sk-...",
  "apiEndpoint": "https://api.openai.com",
  "isDefault": false
}
```

**Response:**
```json
{
  "id": 2,
  "name": "ChatGPT",
  "model": "gpt-4o",
  "temperature": 0.8,
  "maxTokens": 4000,
  "apiKey": "sk-...",
  "apiEndpoint": "https://api.openai.com",
  "isDefault": false,
  "createdAt": "2025-05-15T07:50:00.000Z",
  "updatedAt": "2025-05-15T07:50:00.000Z"
}
```

#### Update LLM Settings

```
PUT /api/llm-settings/{id}
```

**Parameters:**
- `id` (required): ID of the LLM settings to update

**Request Body:**
```json
{
  "name": "Updated Model Name",
  "temperature": 0.5,
  "maxTokens": 3000,
  "isDefault": true
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Updated Model Name",
  "model": "custom",
  "temperature": 0.5,
  "maxTokens": 3000,
  "apiKey": "sk-...",
  "apiEndpoint": "https://api.example.com",
  "isDefault": true,
  "createdAt": "2025-05-15T07:30:00.000Z",
  "updatedAt": "2025-05-15T07:51:00.000Z"
}
```

### Auto-Edit Settings

#### Get Auto-Edit Settings

```
GET /api/auto-edit-settings?userId={userId}
```

**Parameters:**
- `userId` (required): ID of the user to fetch settings for

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "grammarCheck": true,
  "styleConsistency": true,
  "contentImprovement": true,
  "plagiarismCheck": false,
  "createdAt": "2025-05-15T07:30:00.000Z",
  "updatedAt": "2025-05-15T07:30:00.000Z"
}
```

#### Create Auto-Edit Settings

```
POST /api/auto-edit-settings
```

**Request Body:**
```json
{
  "userId": 1,
  "grammarCheck": true,
  "styleConsistency": true,
  "contentImprovement": true,
  "plagiarismCheck": false
}
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "grammarCheck": true,
  "styleConsistency": true,
  "contentImprovement": true,
  "plagiarismCheck": false,
  "createdAt": "2025-05-15T07:52:00.000Z",
  "updatedAt": "2025-05-15T07:52:00.000Z"
}
```

#### Update Auto-Edit Settings

```
PUT /api/auto-edit-settings/{id}
```

**Parameters:**
- `id` (required): ID of the auto-edit settings to update

**Request Body:**
```json
{
  "grammarCheck": true,
  "styleConsistency": false,
  "contentImprovement": true,
  "plagiarismCheck": true
}
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "grammarCheck": true,
  "styleConsistency": false,
  "contentImprovement": true,
  "plagiarismCheck": true,
  "createdAt": "2025-05-15T07:52:00.000Z",
  "updatedAt": "2025-05-15T07:53:00.000Z"
}
```

### Database Settings

#### Get Database Settings

```
GET /api/db-settings?userId={userId}
```

**Parameters:**
- `userId` (required): ID of the user to fetch settings for

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "username": "dbuser",
  "password": "password",
  "host": "localhost",
  "port": 5432,
  "database": "bookdb",
  "schema": "public",
  "useSsl": false,
  "createdAt": "2025-05-15T07:30:00.000Z",
  "updatedAt": "2025-05-15T07:30:00.000Z"
}
```

#### Create Database Settings

```
POST /api/db-settings
```

**Request Body:**
```json
{
  "userId": 1,
  "username": "dbuser",
  "password": "password",
  "host": "localhost",
  "port": 5432,
  "database": "bookdb",
  "schema": "public",
  "useSsl": false
}
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "username": "dbuser",
  "password": "password",
  "host": "localhost",
  "port": 5432,
  "database": "bookdb",
  "schema": "public",
  "useSsl": false,
  "createdAt": "2025-05-15T07:54:00.000Z",
  "updatedAt": "2025-05-15T07:54:00.000Z"
}
```

#### Update Database Settings

```
PUT /api/db-settings/{id}
```

**Parameters:**
- `id` (required): ID of the database settings to update

**Request Body:**
```json
{
  "username": "newuser",
  "password": "newpassword",
  "host": "db.example.com",
  "useSsl": true
}
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "username": "newuser",
  "password": "newpassword",
  "host": "db.example.com",
  "port": 5432,
  "database": "bookdb",
  "schema": "public",
  "useSsl": true,
  "createdAt": "2025-05-15T07:54:00.000Z",
  "updatedAt": "2025-05-15T07:55:00.000Z"
}
```

### Stats

#### Get Book Stats

```
GET /api/stats?userId={userId}
```

**Parameters:**
- `userId` (required): ID of the user to fetch stats for

**Response:**
```json
{
  "totalBooks": 1,
  "totalChapters": 5,
  "totalWords": 5000
}
```

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `204 No Content`: Resource deleted successfully
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses include a JSON object with an error message:

```json
{
  "error": "Error message here"
}
```