# AI Chat Application

## Overview

A modern AI chat application built with React frontend and Express backend. The application provides a conversational interface where users can chat with an AI assistant, manage multiple conversations, and receive streamed responses. The design follows modern AI chat interfaces (ChatGPT, Claude style) with support for both dark and light themes featuring aquamarine (#00c9a7) accent colors.

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

### Theme System
- **Light/Dark Mode**: Full support for both themes with seamless switching
- **ThemeProvider**: React context in `client/src/components/theme-provider.tsx` manages theme state
- **Persistence**: Theme preference saved to localStorage and restored on page load
- **Toggle**: Theme toggle available in UserMenu dropdown at bottom of sidebar
- **Implementation**: Toggles "dark" class on document root, CSS variables defined in `index.css`
- **Colors**: All components use theme-aware Tailwind CSS variables (text-foreground, bg-background, etc.)
- **Dark Mode**: #1a1a1a background, #252525 sidebar
- **Light Mode**: White background, light grey sidebar
- **Primary Accent**: Aquamarine #00c9a7 (consistent in both themes)

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
- **Agents**: Specialized AI agents with custom system prompts (id, name, description, systemPrompt, icon, isDefault)

### AI Integration
- Uses OpenAI-compatible API through Replit AI Integrations
- Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
- Supports text chat, image generation, and voice capabilities
- Streaming responses via Server-Sent Events (SSE)

### MCP Tools Integration
- **Purpose**: Enable AI to interact with external services via Zapier MCP (zapier.com/mcp)
- **Supported Tools**:
  - Google Drive: Browse, read, and manage files
  - Google Sheets: Read data, add rows, modify spreadsheets
- **UI**: + button in chat input opens tool selection popover
- **Flow**: Selected tools appear as removable chips, context is passed to AI system prompt
- **Schema**: MCPTool interface in `shared/schema.ts`

### Agent Management System
- **Purpose**: Switch between specialized AI agents with different system prompts
- **Default Agents**: General Assistant, Code Expert, Creative Writer, Data Analyst, Learning Tutor
- **Custom Agents**: Users can create/edit/delete custom agents with custom system prompts
- **UI Components**:
  - `AgentSelector`: Dropdown in header to switch agents
  - `AgentSettingsModal`: Full CRUD interface for managing agents
- **API Endpoints**: `/api/agents` (GET, POST), `/api/agents/:id` (GET, PATCH, DELETE)
- **Integration**: Selected agent's system prompt is passed to the chat API

### Multi-Channel Support (Discord)
- **Purpose**: Allow users to chat with the AI via Discord in addition to the web interface
- **Implementation**: Discord.js bot in `server/discord-bot.ts`
- **Features**:
  - Responds to direct messages (DMs)
  - Responds when mentioned in servers (@Vibe Chat)
  - Maintains per-user conversation history (last 10 exchanges)
  - Handles long responses by splitting at natural breakpoints (newlines, spaces)
  - Shows typing indicator while generating response
- **Configuration**: Requires `DISCORD_BOT_TOKEN` environment variable
- **Status Endpoint**: `/api/channels/status` returns connection status for all channels
- **UI Component**: `ChannelStatus` in header shows Discord bot connection status

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