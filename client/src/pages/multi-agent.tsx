import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────

const CYAN = "#00B4D8";
const BLUE = "#3B82F6";

// ── MultiAgentPage ────────────────────────────────────────────────────────────

/**
 * /multi-agent page — shell layout for the multi-agent conversation feature.
 * Renders the header, three-column agent/conversation panels, and the bottom
 * control bar. No logic is wired up yet — this is structure only.
 */
export default function MultiAgentPage() {
  const [mode, setMode] = useState<"debate" | "collaborate">("debate");

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center gap-4 px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}
      >
        <Link href="/">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "hsl(var(--muted-foreground))", background: "none", border: "none", cursor: "pointer" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </Link>

        <div className="flex flex-col">
          <h1
            style={{
              fontFamily: "'Orbitron', system-ui, sans-serif",
              fontSize: "1.25rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: CYAN,
              lineHeight: 1.2,
            }}
          >
            Multi-Agent Conversation
          </h1>
          <p
            className="text-sm mt-0.5"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: "hsl(var(--muted-foreground))" }}
          >
            Watch two AI agents debate or collaborate on any topic
          </p>
        </div>
      </header>

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden min-h-0">

        {/* Agent 1 panel */}
        <div
          className="flex flex-col items-center justify-center rounded-xl w-[220px] shrink-0"
          style={{
            border: `2px solid ${CYAN}`,
            background: "hsl(var(--card))",
            minHeight: 0,
          }}
        >
          <span
            className="text-sm font-semibold"
            style={{ color: CYAN, fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: "0.06em" }}
          >
            Agent 1
          </span>
          <span
            className="text-xs mt-1"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Select an agent
          </span>
        </div>

        {/* Conversation display */}
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-xl"
          style={{
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            minHeight: 0,
          }}
        >
          <span
            className="text-sm"
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Conversation will appear here
          </span>
        </div>

        {/* Agent 2 panel */}
        <div
          className="flex flex-col items-center justify-center rounded-xl w-[220px] shrink-0"
          style={{
            border: `2px solid ${BLUE}`,
            background: "hsl(var(--card))",
            minHeight: 0,
          }}
        >
          <span
            className="text-sm font-semibold"
            style={{ color: BLUE, fontFamily: "'Orbitron', system-ui, sans-serif", letterSpacing: "0.06em" }}
          >
            Agent 2
          </span>
          <span
            className="text-xs mt-1"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Select an agent
          </span>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderTop: "1px solid hsl(var(--border))" }}
      >
        {/* Topic input */}
        <input
          type="text"
          placeholder="Enter a topic or question..."
          className="flex-1 rounded-lg px-4 py-2 text-sm outline-none transition-colors"
          style={{
            background: "hsl(var(--input))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--foreground))",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = CYAN;
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))";
          }}
        />

        {/* Mode toggle */}
        <div
          className="flex rounded-lg overflow-hidden shrink-0"
          style={{ border: "1px solid hsl(var(--border))" }}
        >
          {(["debate", "collaborate"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="px-4 py-2 text-sm font-medium capitalize transition-colors"
              style={{
                background: mode === m ? CYAN : "hsl(var(--card))",
                color: mode === m ? "hsl(var(--background))" : "hsl(var(--muted-foreground))",
                border: "none",
                cursor: "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Start button */}
        <button
          type="button"
          disabled
          className="px-6 py-2 rounded-lg text-sm font-semibold shrink-0 transition-opacity"
          style={{
            background: CYAN,
            color: "hsl(var(--background))",
            border: "none",
            fontFamily: "'Orbitron', system-ui, sans-serif",
            letterSpacing: "0.06em",
            opacity: 0.4,
            cursor: "not-allowed",
          }}
        >
          Start
        </button>
      </div>
    </div>
  );
}
