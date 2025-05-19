# AI Book Generator

An advanced AI-powered book writing platform designed to streamline the creative writing process through intelligent content generation and collaborative tools.

## Quick Start

1. Development:
```bash
npm install
npm run dev
```

2. Production:
```bash
npm install
npm run build
npm start
```

The application will be available at http://localhost:5000

## Features

- **AI-Assisted Writing**: Generate book outlines, chapter suggestions, and content
- **Book Management**: Create, edit, and organize your book projects
- **Chapter Management**: Write and structure your book's chapters
- **Statistics Dashboard**: Track word counts, writing streaks, and progress
- **Export Options**: Export your books in multiple formats (PDF, DOCX, HTML, Text)
- **Achievement System**: Earn badges for completing writing milestones
- **Database Storage**: PostgreSQL with in-memory fallback

## Environment Setup

Create a `.env` file with:

```
DATABASE_URL=postgresql://username:password@hostname:5432/aibook
```

If DATABASE_URL is not set, the app will use in-memory storage.

## API Documentation

See [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) for detailed API endpoints.

## User Guide

See [USER_GUIDE.md](docs/USER_GUIDE.md) for detailed usage instructions.

## Project Structure

- `client/`: Frontend React application
- `server/`: Backend Express server
- `shared/`: Shared types and schemas
- `drizzle/`: Database migrations

## Technology Stack

### Frontend
- React with TypeScript
- TailwindCSS + shadcn/ui components
- TanStack Query for data fetching
- Wouter for routing

### Backend
- Express.js
- Drizzle ORM for database interactions
- PostgreSQL for data storage (with in-memory fallback)

### AI Integration
- Support for multiple LLM models (Claude, GPT-4, custom models)

## License

This project is licensed under the MIT License - see the LICENSE file for details.