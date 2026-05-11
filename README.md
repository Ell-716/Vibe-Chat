# Vibe Chat

A full-stack AI chat application with Google OAuth, multi-model support, a customer support dashboard, voice I/O, and document-grounded answers.

---

## Overview

Vibe Chat is a production-ready AI chat platform built for developers and teams who want more than a basic chatbot. It supports multiple large language models simultaneously, lets you define custom prompt agents, connects to external tools via Zapier MCP, and includes a fully featured customer support dashboard with AI-powered ticket routing, escalation rules, and agent management.

Users sign in with Google — conversations, messages, and uploaded documents are private to each account. The storage layer abstracts behind a clean `IStorage` interface backed by PostgreSQL (Drizzle ORM); `MemStorage` is available as a zero-config fallback for development without a database.

---

## Features

### Authentication
- **Google OAuth sign-in** — one-click sign-in via Google OAuth 2.0 (passport-google-oauth20).
- **Session-based authentication** — server-side sessions with memorystore; 24-hour TTL, httpOnly cookies.
- **Private data per user** — conversations, messages, and uploaded documents are isolated by `userId`; every `/api/*` route requires a valid session.

### Level 1 — Core Chat
- **Multi-model LLM chat** — Streaming responses via Server-Sent Events. Conversations and messages are persisted in a sidebar with rename and delete support.
- **MCP Tools (Google Drive & Sheets)** — The AI can read files and spreadsheets through Zapier MCP. Tool invocations surface as status messages in the chat stream.
- **ElevenLabs Voice Widget** — Voice input via speech-to-text and optional voice output via TTS. A toolbar toggle enables auto-playback of AI responses.

### Level 2 — Advanced Features
- **Multiple AI models** — Switch between Llama 3.3 70B (Groq, default), GPT-4o Mini (OpenAI), Claude Sonnet (Anthropic), and Gemini Flash (Google) from the header.
- **Prompt & Agent Management** — Create, edit, and delete custom agents with their own system prompts, icons, and descriptions. Five built-in agents are included (General, Coder, Writer, Analyst, Tutor).
- **Support Workflow Automation** — Full support dashboard at `/support`: ticket creation, AI-powered categorisation, priority and sentiment analysis, smart agent routing, SLA deadlines, escalation rules, AI-suggested responses, and aggregate stats.
- **Multi-channel support (Discord + Email)** — A Discord bot responds to DMs and @mentions. EmailJS sends customer notifications on ticket creation and agent replies.
- **Voice Response to Text** — AI responses are read aloud automatically after each message (markdown stripped before synthesis).

### Level 3 — RAG
- **Document-grounded answers** — Upload PDF files; the server parses, chunks, and indexes them with TF-IDF keyword scoring. Each message retrieves the top-k most relevant chunks and injects them into the system prompt as context. Documents are scoped to the uploading user.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query, wouter |
| Backend | Node.js, Express, TypeScript, tsx |
| Auth | Passport.js, passport-google-oauth20, express-session, memorystore |
| Default AI | Groq (Llama 3.3 70B) |
| Additional AI | OpenAI (GPT-4o Mini), Anthropic (Claude Sonnet), Google Gemini Flash |
| Voice | ElevenLabs (TTS + STT) |
| MCP / Tools | Zapier MCP (Google Drive, Google Sheets) |
| Messaging | Discord.js, EmailJS |
| Storage | PostgreSQL + Drizzle ORM (`DatabaseStorage`); `MemStorage` in-memory fallback |
| Build | esbuild (server), Vite (client) |

---

## Project Structure

```
/
├── client/                      # React SPA (Vite)
│   └── src/
│       ├── App.tsx              # Root — providers + auth-gated wouter router
│       ├── pages/
│       │   ├── chat.tsx         # "/" — main chat interface
│       │   ├── support.tsx      # "/support" — support dashboard
│       │   ├── login.tsx        # "/login" — Google sign-in page
│       │   └── not-found.tsx    # 404 fallback
│       ├── components/          # Feature components
│       │   └── ui/              # shadcn/ui primitives (auto-generated)
│       ├── hooks/               # use-toast, use-mobile, use-auth
│       └── lib/
│           ├── queryClient.ts   # TanStack Query client + apiRequest helper
│           └── utils.ts         # cn() class merge utility
│
├── server/                      # Express HTTP server (port 5000)
│   ├── index.ts                 # Entry point: session, passport, middleware, HTTP server
│   ├── routes.ts                # All route registration (/health, /auth/*, /api/*)
│   ├── storage.ts               # IStorage interface + MemStorage; selects DatabaseStorage when DATABASE_URL set
│   ├── storage.db.ts            # PostgreSQL-backed IStorage (Drizzle)
│   ├── db.ts                    # Drizzle client (pg Pool)
│   ├── config/
│   │   ├── env.ts               # Single source of truth for process.env
│   │   └── passport.ts          # Google OAuth strategy; serialize/deserialize user
│   ├── controllers/
│   │   ├── auth.controller.ts   # /auth/google, /auth/google/callback, /auth/logout, /auth/me
│   │   ├── chat.controller.ts   # Conversations, messages, models, voice
│   │   ├── support.controller.ts# Tickets, agents, escalation rules, stats
│   │   ├── agent.controller.ts  # Prompt agents CRUD
│   │   └── rag.controller.ts    # Document upload, listing, MCP tools
│   ├── middleware/
│   │   └── requireAuth.ts       # Checks req.isAuthenticated(); returns 401 if not
│   └── services/
│       ├── auth.service.ts      # initiateGoogleAuth, handleCallback, logout, getCurrentUser
│       ├── llm.service.ts       # All AI model calls (AsyncGenerator streaming)
│       ├── support.service.ts   # Ticket analysis, routing, escalation checks
│       ├── rag.service.ts       # PDF parsing, chunking, TF-IDF retrieval (userId-scoped)
│       ├── mcp.service.ts       # Zapier MCP JSON-RPC client
│       ├── discord.service.ts   # Discord.js bot
│       ├── elevenlabs.service.ts# TTS and STT
│       └── email.service.ts     # EmailJS notifications
│
├── shared/
│   └── schema.ts                # Drizzle table definitions + all domain types
│
├── .env.example                 # Environment variable template
├── drizzle.config.ts            # Drizzle Kit config (reads DATABASE_URL)
├── tsconfig.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- **Node.js** 20 or later
- **npm** 9 or later
- **PostgreSQL 16** — required for persistent storage and user authentication
- **Google Cloud project** with an OAuth 2.0 web application credential configured (see [Google Cloud Console](https://console.cloud.google.com/))
  - Authorised redirect URI: `http://localhost:5000/auth/google/callback`

### Installation

```bash
# 1. Install PostgreSQL 16 (macOS)
brew install postgresql@16 && brew services start postgresql@16

# 2. Create the database
createdb vibechat

# 3. Clone the repo
git clone <your-repo-url>
cd Vibe-Chat

# 4. Install dependencies
npm install

# 5. Create your environment file and fill in the required variables
cp .env.example .env

# 6. Push the schema to the database
npm run db:push

# 7. Start the development server
npm run dev
# → http://localhost:5000
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | **Yes** | Secret used to sign session cookies. Use a long random string. |
| `GOOGLE_CLIENT_ID` | **Yes** | OAuth 2.0 client ID from Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | **Yes** | OAuth 2.0 client secret from Google Cloud Console. |
| `APP_URL` | **Yes** | Base URL of the app, used to construct the OAuth callback URL (e.g. `http://localhost:5000`). |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (e.g. `postgresql://localhost:5432/vibechat`). |
| `GROQ_API_KEY` | **Yes** | Default AI provider (Llama 3.3 70B). Get one at [console.groq.com](https://console.groq.com). |
| `OPENAI_API_KEY` | Optional | Enables GPT-4o Mini model and support ticket AI analysis. |
| `ANTHROPIC_API_KEY` | Optional | Enables Claude Sonnet model. |
| `GOOGLE_GEMINI_API_KEY` | Optional | Enables Gemini Flash model. |
| `ELEVENLABS_API_KEY` | Optional | Enables voice input (STT) and voice output (TTS). |
| `ZAPIER_MCP_URL` | Optional | Enables Google Drive and Google Sheets MCP tools. |
| `ZAPIER_MCP_API_KEY` | Optional | Auth key for the Zapier MCP endpoint. |
| `DISCORD_BOT_TOKEN` | Optional | Enables the Discord bot integration. |
| `EMAILJS_SERVICE_ID` | Optional | EmailJS service ID for ticket email notifications. |
| `EMAILJS_TEMPLATE_ID` | Optional | EmailJS template ID for ticket email notifications. |
| `EMAILJS_PUBLIC_KEY` | Optional | EmailJS public key. |
| `EMAILJS_PRIVATE_KEY` | Optional | EmailJS private key. |

### Available Scripts

```bash
npm run dev        # Development server — Express + Vite HMR on http://localhost:5000
npm run build      # Production build (esbuild + Vite)
npm start          # Serve the production build
npm run check      # TypeScript type-check only
npm run db:push    # Push Drizzle schema changes to PostgreSQL
```

---

## Roadmap

- ✅ **Google OAuth authentication** — Sign in with Google; session-based auth with Passport.js.
- ✅ **PostgreSQL persistent storage** — Drizzle ORM-backed `DatabaseStorage`; schema managed via `db:push`.
- ✅ **Private data per user** — All conversations and documents are isolated by `userId`.
- **User profile page** — View and edit display name, avatar, and preferences.
- **Email / password auth option** — Alternative to Google OAuth for self-hosted deployments.
- **Admin dashboard** — Usage analytics, user management, and system health for operators.
- **Ticket analytics** — Charts for ticket volume, response time trends, and agent performance using Recharts.
- **Streaming tool results** — Surface MCP tool call progress inline in the chat bubble.

---

## License

MIT
