import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Rocket, FileText, Bot, ChevronDown } from "lucide-react";

// ── Design tokens (mirrors settings.tsx pattern) ──────────────────────────────

const CYAN = "#00B4D8";
const CARD_BG = "hsl(var(--card))";
const BORDER = "hsl(var(--border))";

// ── Getting-started cards ─────────────────────────────────────────────────────

const QUICK_CARDS = [
  {
    Icon: Rocket,
    title: "Start Chatting",
    description: "Type a message and press Enter. Switch models from the top right dropdown.",
  },
  {
    Icon: FileText,
    title: "Upload Documents",
    description: "Click the + icon and select Upload PDF to chat with your documents via RAG.",
  },
  {
    Icon: Bot,
    title: "Switch Agents",
    description: "Choose a specialized AI agent from the top bar for different tasks.",
  },
];

// ── FAQ data ──────────────────────────────────────────────────────────────────

const FAQ_GROUPS: Array<{
  category: string;
  items: Array<{ q: string; a: string }>;
}> = [
  {
    category: "Chat",
    items: [
      {
        q: "How do I start a new conversation?",
        a: 'Click the "+ New Chat" button in the sidebar. Each conversation is saved automatically and appears in your history.',
      },
      {
        q: "Which AI models are available?",
        a: "Vibe Chat supports Llama 3.3 70B (default, free via Groq), GPT-4o Mini, Claude Sonnet, Gemini 1.5 Flash, and DeepSeek V4 Flash. Switch between them using the model selector in the top right.",
      },
      {
        q: "Can I use different AI agents?",
        a: "Yes — use the agent selector in the top bar to switch between General Assistant, Creative Writer, Data Analyst, Learning Tutor, and Code Expert. Each has a specialized system prompt.",
      },
    ],
  },
  {
    category: "Documents",
    items: [
      {
        q: "What file types can I upload?",
        a: "Currently PDF files are supported. Documents are processed with RAG so the AI can answer questions based on your content.",
      },
      {
        q: "Are my documents private?",
        a: "Yes — all uploaded documents are private to your account and never shared with other users.",
      },
      {
        q: "How many documents can I upload?",
        a: "There is currently no hard limit. Documents persist across sessions as long as your account is active.",
      },
    ],
  },
  {
    category: "Integrations",
    items: [
      {
        q: "How does the Discord integration work?",
        a: "Connect your Discord server and Vibe Chat will respond to messages in your configured channel using the active AI model.",
      },
      {
        q: "What can I do with Google Drive integration?",
        a: "Using the MCP Tools feature you can browse Google Drive files and add rows to Google Sheets directly from the chat.",
      },
    ],
  },
  {
    category: "Account",
    items: [
      {
        q: "How do I change my display name?",
        a: "Go to Settings → Account and edit your Display Name field.",
      },
      {
        q: "How do I delete my account?",
        a: "Go to Settings → Danger Zone and click Delete Account. This action is permanent and cannot be undone.",
      },
    ],
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * A single FAQ accordion row. Manages its own open/closed state.
 * @param q - The question text.
 * @param a - The answer text.
 */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left cursor-pointer transition-colors duration-150"
        style={{ background: "transparent", border: "none" }}
        aria-expanded={open}
      >
        <span
          className="text-sm font-medium"
          style={{ color: "hsl(var(--foreground))" }}
        >
          {q}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform duration-200"
          style={{
            color: CYAN,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <p
          className="pb-4 text-sm leading-relaxed"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          {a}
        </p>
      )}
    </div>
  );
}

/**
 * One grouped FAQ block with a category label and its accordion items.
 * @param category - Category label shown above the group.
 * @param items - List of question/answer pairs.
 */
function FaqGroup({
  category,
  items,
}: {
  category: string;
  items: Array<{ q: string; a: string }>;
}) {
  return (
    <div className="mb-6">
      <p
        className="text-xs font-semibold uppercase mb-1"
        style={{
          color: CYAN,
          letterSpacing: "0.12em",
          fontFamily: "'Orbitron', sans-serif",
        }}
      >
        {category}
      </p>
      <div
        className="rounded-xl overflow-hidden px-5"
        style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
      >
        {items.map((item) => (
          <FaqItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * Help page at /help.
 * Hero → quick-start cards → FAQ accordion → contact card.
 */
export default function HelpPage() {
  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        background: "hsl(var(--background))",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div className="max-w-[800px] mx-auto px-6 py-12">

        {/* ── Back to Chat ─────────────────────────────────────────────── */}
        <Link href="/">
          <button
            className="flex items-center gap-2 mb-10 text-sm cursor-pointer transition-colors duration-150"
            style={{ color: "hsl(var(--muted-foreground))", background: "transparent", border: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = CYAN; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "hsl(var(--muted-foreground))"; }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </button>
        </Link>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center mb-12">
          <img
            src="/logo.png"
            alt="Vibe Chat"
            style={{
              width: 100,
              height: 100,
              objectFit: "contain",
              marginBottom: 24,
              filter: `drop-shadow(0 0 16px rgba(0,180,216,0.45))`,
              animation: "float 3s ease-in-out infinite",
            }}
          />
          <h1
            className="text-3xl font-bold mb-3"
            style={{ fontFamily: "'Orbitron', sans-serif", color: "hsl(var(--foreground))" }}
          >
            How can we help?
          </h1>
          <p
            className="text-base max-w-[480px] leading-relaxed"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Everything you need to get the most out of Vibe Chat
          </p>
        </div>

        {/* ── Getting started cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {QUICK_CARDS.map(({ Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl p-5 flex flex-col gap-3 transition-all duration-200"
              style={{
                background: CARD_BG,
                border: `1px solid ${BORDER}`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,180,216,0.45)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 20px rgba(0,180,216,0.12)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = BORDER;
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(0,180,216,0.12)" }}
              >
                <Icon className="h-4 w-4" style={{ color: CYAN }} />
              </div>
              <div>
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: "hsl(var(--foreground))" }}
                >
                  {title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <h2
          className="text-xl font-bold mb-6"
          style={{ fontFamily: "'Orbitron', sans-serif", color: "hsl(var(--foreground))" }}
        >
          Frequently Asked Questions
        </h2>

        {FAQ_GROUPS.map((group) => (
          <FaqGroup key={group.category} category={group.category} items={group.items} />
        ))}

        {/* ── Contact card ─────────────────────────────────────────────── */}
        <div
          className="rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4"
          style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
        >
          <div>
            <p
              className="text-base font-semibold mb-1"
              style={{ color: "hsl(var(--foreground))" }}
            >
              Still need help?
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              Can't find what you're looking for? Submit a support ticket and we'll get back to you.
            </p>
          </div>
          <Link href="/support">
            <a
              className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer"
              style={{
                border: `1px solid ${CYAN}`,
                color: CYAN,
                background: "transparent",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,180,216,0.1)";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 0 12px rgba(0,180,216,0.25)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
              }}
            >
              Open Support
            </a>
          </Link>
        </div>

      </div>

      {/* Float keyframe — reuses the same animation from the chat empty state */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
