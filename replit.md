# Replit.md

## Overview

This is a Discord bot application with a web dashboard built using a full-stack TypeScript architecture. The project combines a React frontend with an Express backend, featuring AI integrations for chat, voice, and image generation capabilities through OpenAI APIs. The Discord bot provides server management features including ticket systems, welcome messages, and staff management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (supports light/dark modes)
- **Build Tool**: Vite with React plugin and Replit-specific development plugins

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **Build**: esbuild for production bundling with selective dependency bundling for cold start optimization
- **Hot Reload**: Vite middleware integration for development

### Discord Bot Integration
- **Library**: discord.js v14
- **Features**: Guild management, ticket systems, welcome messages, slash commands
- **AI Integration**: OpenAI for chat responses within Discord

### AI Integrations (Replit AI Integrations)
The project includes pre-built integration modules in `server/replit_integrations/` and `client/replit_integrations/`:
- **Chat**: Text-based conversational AI with conversation persistence
- **Audio/Voice**: Speech-to-text, text-to-speech, and voice chat streaming with AudioWorklet support
- **Image**: Image generation using GPT-image-1 model
- **Batch Processing**: Rate-limited batch operations with automatic retries

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` for shared type definitions
- **Migrations**: Drizzle Kit for schema management (`drizzle-kit push`)
- **Validation**: Zod with drizzle-zod for schema-based validation
- **Storage Pattern**: Interface-based storage abstraction (`IStorage`) with in-memory implementation available

### Project Structure
```
├── client/               # React frontend
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and query client
│   │   └── pages/          # Route components
│   └── replit_integrations/  # Client-side AI integration utilities
├── server/               # Express backend
│   ├── bot.ts              # Discord bot implementation
│   ├── routes.ts           # API route registration
│   ├── storage.ts          # Data storage interface
│   └── replit_integrations/  # Server-side AI modules
├── shared/               # Shared types and schemas
│   ├── schema.ts           # Drizzle database schema
│   └── models/             # Additional data models
└── migrations/           # Database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **connect-pg-simple**: Session storage for Express sessions

### AI Services (Replit AI Integrations)
- **OpenAI API**: Used for chat completions, image generation, and audio processing
  - Requires `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables
  - Accessed through Replit's AI integrations proxy

### Discord
- **Discord Bot Token**: Required for `discord.js` client authentication
- **Admin Configuration**: Hardcoded admin ID for privileged operations

### External Packages
- **ffmpeg**: Required system dependency for audio format conversion (webm → wav)
- **p-limit/p-retry**: Batch processing with rate limiting and retries

### Development Tools
- Replit-specific Vite plugins for development (cartographer, dev-banner, runtime-error-modal)