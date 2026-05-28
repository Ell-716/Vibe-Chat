import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────

const CYAN = "#00B4D8";

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentConfig = {
  id: string;
  name: string;
  avatar: string;
  accentColor: string;
  systemPrompt: string;
};

// ── Static taglines (one per agent, shown beneath the name) ───────────────────

const TAGLINES: Record<string, string> = {
  general_assistant: "Balanced & helpful",
  creative_writer: "Imaginative & expressive",
  data_analyst: "Precise & evidence-driven",
  learning_tutor: "Patient & clear",
  code_expert: "Technical & systematic",
};

// ── AgentCard ─────────────────────────────────────────────────────────────────

/**
 * A single selectable agent card inside a selector panel.
 * @param agent - The agent configuration to display.
 * @param selected - Whether this card is currently selected.
 * @param disabled - Whether this card is unselectable (same agent chosen on other side).
 * @param onSelect - Callback fired when the card is clicked.
 */
function AgentCard({
  agent,
  selected,
  disabled,
  onSelect,
}: {
  agent: AgentConfig;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const accent = agent.accentColor;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      className="relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all"
      style={{
        background: selected ? `${accent}1A` : "transparent",
        border: `1.5px solid ${selected ? accent : "hsl(var(--border))"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
      }}
      onMouseEnter={(e) => {
        if (!selected && !disabled)
          (e.currentTarget as HTMLElement).style.borderColor = accent;
      }}
      onMouseLeave={(e) => {
        if (!selected && !disabled)
          (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))";
      }}
    >
      {/* Avatar */}
      <img
        src={`/${agent.avatar}`}
        alt={agent.name}
        width={40}
        height={40}
        className="rounded-full shrink-0 object-cover"
        style={{ border: `2px solid ${selected ? accent : "transparent"}` }}
      />

      {/* Name + tagline */}
      <div className="flex flex-col min-w-0">
        <span
          className="text-sm font-medium truncate"
          style={{
            color: selected ? accent : "hsl(var(--foreground))",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          {agent.name}
        </span>
        <span
          className="text-xs truncate"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
          {TAGLINES[agent.id] ?? ""}
        </span>
      </div>

      {/* Selected checkmark */}
      {selected && (
        <Check
          className="absolute top-2 right-2 h-3.5 w-3.5 shrink-0"
          style={{ color: accent }}
        />
      )}
    </button>
  );
}

// ── AgentSelectorPanel ────────────────────────────────────────────────────────

/**
 * Left or right selector panel housing the list of agent cards.
 * @param label - "Agent 1" or "Agent 2".
 * @param accentColor - Border/label color for the panel header.
 * @param agents - All available agents.
 * @param selectedId - Currently selected agent id (or null).
 * @param disabledId - Agent id locked out because it was chosen on the other side.
 * @param isLoading - True while the agent list is being fetched.
 * @param onSelect - Callback with the selected agent id.
 * @param conflict - Whether a same-agent conflict message should be shown.
 */
function AgentSelectorPanel({
  label,
  accentColor,
  agents,
  selectedId,
  disabledId,
  isLoading,
  onSelect,
  conflict,
}: {
  label: string;
  accentColor: string;
  agents: AgentConfig[];
  selectedId: string | null;
  disabledId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  conflict: boolean;
}) {
  return (
    <div
      className="flex flex-col rounded-xl w-[230px] shrink-0 overflow-hidden"
      style={{ border: `2px solid ${accentColor}`, background: "hsl(var(--card))" }}
    >
      {/* Panel header */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${accentColor}30` }}
      >
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: accentColor, fontFamily: "'Orbitron', system-ui, sans-serif" }}
        >
          {label}
        </span>
        {conflict && (
          <p className="text-xs mt-0.5" style={{ color: "#F97316", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            Agents must be different
          </p>
        )}
      </div>

      {/* Card list */}
      <div className="flex flex-col gap-1.5 p-3 overflow-y-auto flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: accentColor }} />
          </div>
        ) : (
          agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              selected={selectedId === agent.id}
              disabled={disabledId === agent.id}
              onSelect={() => onSelect(agent.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── MultiAgentPage ────────────────────────────────────────────────────────────

/**
 * /multi-agent page — lets the user pick two agents, choose a mode and topic,
 * then start a multi-agent conversation.
 */
export default function MultiAgentPage() {
  const [mode, setMode] = useState<"debate" | "collaborate">("debate");
  const [topic, setTopic] = useState("");
  const [agent1Id, setAgent1Id] = useState<string | null>(null);
  const [agent2Id, setAgent2Id] = useState<string | null>(null);
  const [conflict, setConflict] = useState<1 | 2 | null>(null);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch agents on mount
  useEffect(() => {
    fetch("/api/multi-agent/agents")
      .then((r) => r.json())
      .then((data: Record<string, AgentConfig>) => {
        setAgents(Object.values(data));
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  /**
   * Selects an agent for panel 1.
   * If the same agent is already chosen for panel 2, clears panel 2 and shows
   * the conflict warning briefly.
   * @param id - The agent id being selected.
   */
  const handleSelectAgent1 = (id: string) => {
    if (id === agent2Id) {
      setAgent2Id(null);
      setConflict(2);
      setTimeout(() => setConflict(null), 3000);
    } else {
      setConflict(null);
    }
    setAgent1Id(id);
  };

  /**
   * Selects an agent for panel 2.
   * If the same agent is already chosen for panel 1, clears panel 1 and shows
   * the conflict warning briefly.
   * @param id - The agent id being selected.
   */
  const handleSelectAgent2 = (id: string) => {
    if (id === agent1Id) {
      setAgent1Id(null);
      setConflict(1);
      setTimeout(() => setConflict(null), 3000);
    } else {
      setConflict(null);
    }
    setAgent2Id(id);
  };

  const canStart = !!agent1Id && !!agent2Id && topic.trim().length > 0;

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

        {/* Agent 1 selector */}
        <AgentSelectorPanel
          label="Agent 1"
          accentColor={CYAN}
          agents={agents}
          selectedId={agent1Id}
          disabledId={agent2Id}
          isLoading={isLoading}
          onSelect={handleSelectAgent1}
          conflict={conflict === 1}
        />

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

        {/* Agent 2 selector */}
        <AgentSelectorPanel
          label="Agent 2"
          accentColor="#3B82F6"
          agents={agents}
          selectedId={agent2Id}
          disabledId={agent1Id}
          isLoading={isLoading}
          onSelect={handleSelectAgent2}
          conflict={conflict === 2}
        />
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderTop: "1px solid hsl(var(--border))" }}
      >
        {/* Topic input */}
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic or question..."
          className="flex-1 rounded-lg px-4 py-2 text-sm outline-none transition-colors"
          style={{
            background: "hsl(var(--input))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--foreground))",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
          onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = CYAN; }}
          onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))"; }}
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
          disabled={!canStart}
          className="px-6 py-2 rounded-lg text-sm font-semibold shrink-0 transition-opacity"
          style={{
            background: CYAN,
            color: "hsl(var(--background))",
            border: "none",
            fontFamily: "'Orbitron', system-ui, sans-serif",
            letterSpacing: "0.06em",
            opacity: canStart ? 1 : 0.4,
            cursor: canStart ? "pointer" : "not-allowed",
          }}
        >
          Start
        </button>
      </div>
    </div>
  );
}
