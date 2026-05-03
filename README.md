# Vibe Chat

A full-stack AI chat application with multi-model support, a customer support dashboard, voice I/O, and document-grounded answers.

---

## Overview

Vibe Chat is a production-ready AI chat platform built for developers and teams who want more than a basic chatbot. It supports multiple large language models simultaneously, lets you define custom prompt agents, connects to external tools via Zapier MCP, and includes a fully featured customer support dashboard with AI-powered ticket routing, escalation rules, and agent management.

The app is designed to be extended: the storage layer abstracts behind a clean interface so MemStorage (in-memory, zero-config) can be swapped for a PostgreSQL-backed implementation without touching any application code.

---

## Features

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
- **Document-grounded answers** — Upload PDF files; the server parses, chunks, and embeds them with OpenAI `text-embedding-3-small`. Each message retrieves the top-k most relevant chunks via cosine similarity and injects them into the system prompt as context.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query, wouter |
| Backend | Node.js, Express, TypeScript, tsx |
| Default AI | Groq (Llama 3.3 70B) |
| Additional AI | OpenAI (GPT-4o Mini, embeddings), Anthropic (Claude Sonnet), Google Gemini Flash |
| Voice | ElevenLabs (TTS + STT) |
| MCP / Tools | Zapier MCP (Google Drive, Google Sheets) |
| Messaging | Discord.js, EmailJS |
| Storage | In-memory Maps (MemStorage); Drizzle ORM + PostgreSQL ready |
| Build | esbuild (server), Vite (client) |

---

## Project Structure

```
/
├── client/                      # React SPA (Vite)
│   └── src/
│       ├── App.tsx              # Root — providers + wouter router
│       ├── pages/
│       │   ├── chat.tsx         # "/" — main chat interface
│       │   ├── support.tsx      # "/support" — support dashboard
│       │   └── not-found.tsx    # 404 fallback
│       ├── components/          # Feature components
│       │   └── ui/              # shadcn/ui primitives (auto-generated)
│       ├── hooks/               # use-toast, use-mobile
│       └── lib/
│           ├── queryClient.ts   # TanStack Query client + apiRequest helper
│           └── utils.ts         # cn() class merge utility
│
├── server/                      # Express HTTP server (port 5000)
│   ├── index.ts                 # Entry point: middleware, Discord bot, HTTP server
│   ├── routes.ts                # /api/* route registration
│   ├── support-routes.ts        # /api/support/* route registration
│   ├── storage.ts               # IStorage interface + MemStorage implementation
│   ├── config/
│   │   └── env.ts               # Single source of truth for process.env
│   ├── controllers/
│   │   ├── chat.controller.ts   # Conversations, messages, models, voice
│   │   ├── support.controller.ts# Tickets, agents, escalation rules, stats
│   │   ├── agent.controller.ts  # Prompt agents CRUD
│   │   ├── rag.controller.ts    # Document upload and listing
│   │   └── mcp.controller.ts    # MCP tool discovery
│   └── services/
│       ├── llm.service.ts       # All AI model calls (AsyncGenerator streaming)
│       ├── support.service.ts   # Ticket analysis, routing, escalation checks
│       ├── rag.service.ts       # PDF parsing, chunking, embedding, retrieval
│       ├── mcp.service.ts       # Zapier MCP JSON-RPC client
│       ├── discord.service.ts   # Discord.js bot
│       ├── elevenlabs.service.ts# TTS and STT
│       └── email.service.ts     # EmailJS notifications
│
├── shared/
│   └── schema.ts                # All domain types shared by server and client
│
├── script/
│   └── build.mjs                # Production build script (esbuild + Vite)
│
├── .env.example                 # Environment variable template
├── tsconfig.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- **Node.js** 20 or later
- **npm** 9 or later

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd Vibe-Chat

# Install dependencies
npm install

# Create your environment file
cp .env.example .env
```

Open `.env` and fill in at minimum `GROQ_API_KEY` to get started (see table below).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | **Yes** | Default AI provider (Llama 3.3 70B). Get one at [console.groq.com](https://console.groq.com). |
| `OPENAI_API_KEY` | Optional | Enables GPT-4o Mini model, PDF embeddings for RAG, and support ticket AI analysis. |
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
| `DATABASE_URL` | Optional | PostgreSQL connection string. Not used by the default MemStorage layer. |
| `SESSION_SECRET` | Optional | Secret for session signing (if auth middleware is added). |

### Running the App

```bash
# Development — Express + Vite HMR on http://localhost:5000
npm run dev

# Production build
npm run build

# Serve the production build
npm start

# Type-check only
npm run check
```

---

## Roadmap

- **User authentication** — Login / signup with session-based auth (Passport.js is already installed).
- **PostgreSQL persistence** — The `IStorage` interface is ready; a Drizzle-backed implementation will make all data durable across restarts. Schema is defined in `shared/schema.ts` and can be pushed with `npm run db:push`.
- **Ticket analytics** — Charts for ticket volume, response time trends, and agent performance over time using the existing Recharts dependency.
- **Streaming tool results** — Surface MCP tool call progress inline in the chat bubble rather than as separate status messages.

---

## License

MIT
