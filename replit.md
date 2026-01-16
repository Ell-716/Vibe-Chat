# AI Chat Application

## Overview

A modern AI chat application built with React frontend and Express backend. The application provides a conversational interface where users can chat with an AI assistant, manage multiple conversations, and receive streamed responses. The design follows modern AI chat interfaces (ChatGPT, Claude style) with a dark theme featuring aquamarine accents.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build Tool**: Vite with HMR support

The frontend follows a component-based architecture with:
- Page components in `client/src/pages/`
- Reusable UI components in `client/src/components/ui/`
- Feature components in `client/src/components/`
- Custom hooks in `client/src/hooks/`

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful API with streaming support for AI responses
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Location**: Shared schema in `shared/schema.ts`

Key backend patterns:
- Routes registered in `server/routes.ts`
- Storage abstraction layer in `server/storage.ts` (supports memory and database)
- Static file serving for production builds
- Development uses Vite middleware for HMR

### Data Models
- **Users**: Basic user model with id, username, password
- **Conversations**: Chat sessions with title and timestamp
- **Messages**: Individual messages with role (user/assistant), content, and conversation reference

### AI Integration
- Uses OpenAI-compatible API through Replit AI Integrations
- Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
- Supports text chat, image generation, and voice capabilities
- Streaming responses via Server-Sent Events (SSE)

### Replit Integration Modules
Located in `server/replit_integrations/`:
- **chat/**: Text-based conversation handling with streaming
- **audio/**: Voice chat with speech-to-text and text-to-speech
- **image/**: Image generation using gpt-image-1
- **batch/**: Batch processing utilities with rate limiting

## External Dependencies

### Database
- PostgreSQL via Drizzle ORM
- Schema migrations in `migrations/` directory
- Connection via `DATABASE_URL` environment variable

### AI Services
- OpenAI-compatible API (Replit AI Integrations)
- Models: GPT for chat, gpt-image-1 for images
- Audio processing requires ffmpeg for format conversion

### Key NPM Packages
- **Frontend**: React, TanStack Query, Radix UI, Tailwind CSS, Wouter
- **Backend**: Express, Drizzle ORM, OpenAI SDK
- **Shared**: Zod for validation, drizzle-zod for schema validation

### Build & Development
- Vite for frontend bundling
- esbuild for server bundling
- TypeScript throughout
- Development server with HMR at `npm run dev`
- Production build via `npm run build`