# AI Book Generator - Technical Architecture

This document outlines the technical architecture of the AI Book Generator application, detailing the component structure, data flow, and implementation details.

## System Overview

AI Book Generator is a full-stack web application built with a modern JavaScript/TypeScript stack. The architecture follows a client-server pattern with the frontend and backend clearly separated but packaged together for deployment simplicity.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Frontend     │◄───►│     Backend     │◄───►│    Database     │
│    (React)      │     │    (Express)    │     │  (PostgreSQL)   │
│                 │     │                 │     │  (In-Memory)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Directory Structure

```
/
├── client/                  # Frontend React application
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility functions and services
│   │   ├── pages/           # Application pages/routes
│   │   ├── App.tsx          # Main React component
│   │   ├── index.css        # Global styles
│   │   └── main.tsx         # Entry point
│   └── index.html           # HTML template
├── server/                  # Backend Express server
│   ├── db.ts                # Database connection setup
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # API route definitions
│   ├── storage.ts           # Data storage interface
│   └── vite.ts              # Vite server configuration
├── shared/                  # Shared code between client and server
│   └── schema.ts            # Database schema and type definitions
├── docs/                    # Documentation
├── components.json          # UI component configuration
├── drizzle.config.ts        # Database ORM configuration
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Build tool configuration
```

## Frontend Architecture

The frontend is built with React and follows a component-based architecture. It uses modern React patterns including hooks, context, and functional components.

### Key Components

1. **App.tsx**: The root component that sets up routing and global state
2. **pages/**: Individual page components corresponding to routes
   - **Dashboard.tsx**: Home page with statistics and recent books
   - **Projects.tsx**: List of all book projects
   - **Editor.tsx**: Main editing interface for chapters
   - **Settings.tsx**: Application and model settings
3. **components/**: Reusable UI components
   - **ui/**: Shadcn UI components for consistent styling
   - **editor/**: Editor-specific components for book writing
   - **layout/**: Page layout components like Sidebar and Navbar

### State Management

- **TanStack Query**: For data fetching, caching, and synchronization with the server
- **React Context**: For global state that needs to be accessible throughout the app
- **Local Component State**: For UI state specific to individual components

### Routing

- **Wouter**: Lightweight routing solution for navigating between pages

### Styling

- **TailwindCSS**: Utility-first CSS framework
- **shadcn/ui**: Component library built on top of Tailwind

## Backend Architecture

The backend is built with Express and implements a straightforward REST API. It serves as a thin layer between the client and the data storage mechanisms.

### Key Components

1. **index.ts**: Server entry point and Express configuration
2. **routes.ts**: Defines API routes and handlers
3. **storage.ts**: Provides a consistent interface for data operations
4. **db.ts**: Database connection and configuration

### Storage Interface

The application implements the Repository pattern through the `IStorage` interface, allowing for different storage implementations:

1. **DatabaseStorage**: Uses PostgreSQL database (via Drizzle ORM)
2. **MemStorage**: Uses in-memory JavaScript objects for storage

The application automatically selects the appropriate storage implementation based on the availability of a database connection.

### API Routes

The server exposes REST API endpoints for:
- **Books**: CRUD operations for book projects
- **Chapters**: CRUD operations for book chapters
- **LLM Settings**: Managing AI model configurations
- **Auto-Edit Settings**: Configuring automatic editing features
- **Database Settings**: Configuring database connections

## Data Model

The data model is defined in `shared/schema.ts` using Drizzle ORM schema definitions:

### Core Entities

1. **User**: Represents application users
2. **Book**: Represents a book project
3. **Chapter**: Represents a chapter within a book
4. **LLM Settings**: Stores AI model configurations
5. **Auto-Edit Settings**: Stores auto-editing preferences
6. **Database Settings**: Stores database connection information
7. **Edit**: Stores the history of edits to chapters

### Key Relationships

```
┌─────────┐     ┌───────┐     ┌─────────┐
│         │     │       │     │         │
│  User   │1────┤ Book  │1────┤ Chapter │
│         │     │       │     │         │
└─────────┘     └───────┘     └─────────┘
     │             │
     │             │
     │          ┌──────────────┐
     │          │              │
     └──────────┤ LLM Settings │
     │          │              │
     │          └──────────────┘
     │
┌────────────────┐    ┌───────────────┐
│                │    │               │
│ Auto-Edit      │    │ Database      │
│ Settings       │    │ Settings      │
│                │    │               │
└────────────────┘    └───────────────┘
```

## AI Integration

The application integrates with various LLM models through well-defined interfaces:

### LLM Service

This service handles interactions with AI models and provides consistent methods for:
- Generating book outlines
- Generating chapter suggestions
- Creating content based on outlines
- Auto-editing existing content

### Model Configuration

The application supports multiple AI models:
- **Claude (Anthropic)**: For high-quality creative writing
- **GPT (OpenAI)**: For versatile text generation
- **Custom Models**: Support for other models via custom endpoints

## Database Design

### Schema

The database schema is designed to efficiently store and retrieve book-related data:

```
books
  ├── id (PK)
  ├── title
  ├── description
  ├── outline
  ├── status
  ├── userId (FK)
  ├── llmSettingsId (FK)
  ├── wordCount
  ├── chapterCount
  ├── createdAt
  └── updatedAt

chapters
  ├── id (PK)
  ├── title
  ├── content
  ├── outline
  ├── status
  ├── orderIndex
  ├── bookId (FK)
  ├── wordCount
  ├── createdAt
  └── updatedAt

llm_settings
  ├── id (PK)
  ├── name
  ├── model
  ├── temperature
  ├── maxTokens
  ├── apiKey
  ├── apiEndpoint
  ├── isDefault
  ├── createdAt
  └── updatedAt

auto_edit_settings
  ├── id (PK)
  ├── userId (FK)
  ├── grammarCheck
  ├── styleConsistency
  ├── contentImprovement
  ├── plagiarismCheck
  ├── createdAt
  └── updatedAt
```

### Indices

The database uses indices for optimizing common queries:
- Primary key indices on all tables
- Foreign key indices for relationship lookups
- Additional indices on frequently queried fields

## Build and Deployment

### Development

The application uses Vite for both development and production builds:
- Frontend: React + TypeScript through Vite
- Backend: Express through tsx (TypeScript execution)

### Production

For production, the application can be built into a single deployable unit:
- Frontend: Built to static files
- Backend: Transpiled to JavaScript
- Served through Express with static file middleware

## Security Considerations

1. **API Keys**: API keys for LLM services are stored securely
2. **Database Credentials**: Database credentials are managed through environment variables
3. **Input Validation**: All user inputs are validated before processing
4. **Error Handling**: Comprehensive error handling prevents information leakage

## Performance Optimizations

1. **Query Caching**: TanStack Query provides efficient data caching
2. **Connection Pooling**: PostgreSQL connections are pooled for efficiency
3. **Lazy Loading**: Components and routes are loaded on demand
4. **Response Compression**: API responses are compressed

## Future Architecture Expansion

The architecture is designed to accommodate future enhancements:
1. **Authentication System**: Ready for integration with auth providers
2. **Collaboration Features**: The data model supports multi-user editing
3. **Export Services**: Extensible for adding export functionality
4. **Mobile Support**: The UI components are designed to be responsive

## Troubleshooting

Common issues and their solutions:
1. **Database Connection**: Check environment variables and network connectivity
2. **AI Integration**: Verify API keys and endpoint configurations
3. **Performance Issues**: Check database indices and query patterns