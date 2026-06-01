import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Loader2, Bot, ThumbsUp, ThumbsDown } from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────

const CYAN = "#00B4D8";
const BLUE = "#3B82F6";

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentConfig = {
  id: string;
  name: string;
  avatar: string;
  accentColor: string;
  systemPrompt: string;
};

type AgentTurn = {
  agentId: string;
  agentName: string;
  content: string;
  turnNumber: number;
};

type ImprovementResult = {
  agentId: string;
  previousVersion: number;
  newVersion: number;
  newPrompt: string;
  triggerType: "user" | "auto";
};

// ── Static taglines ───────────────────────────────────────────────────────────

const TAGLINES: Record<string, string> = {
  general_assistant: "Balanced & helpful",
  creative_writer: "Imaginative & expressive",
  data_analyst: "Precise & evidence-driven",
  learning_tutor: "Patient & clear",
  code_expert: "Technical & systematic",
};

// ── TypingIndicator ───────────────────────────────────────────────────────────

/**
 * Three animated bouncing dots shown while an agent is generating its response.
 * @param accentColor - Color used for the dots.
 */
function TypingIndicator({ accentColor }: { accentColor: string }) {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: 6,
            height: 6,
            background: accentColor,
            display: "inline-block",
            animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── TurnBubble ────────────────────────────────────────────────────────────────

/**
 * A single conversation turn rendered as a chat bubble.
 * Agent 1 bubbles align left; Agent 2 bubbles align right.
 * 👍/👎 buttons appear below the bubble on hover or when a vote is active.
 * @param turn - The AgentTurn data to display.
 * @param isAgent1 - True if this turn belongs to agent 1 (left-aligned).
 * @param agentConfig - Full config for the speaking agent.
 * @param conversationId - Session UUID used to group feedback signals.
 * @param currentVote - The vote the user has cast for this turn, if any.
 * @param onVote - Callback fired when the user clicks a vote button.
 */
function TurnBubble({
  turn,
  isAgent1,
  agentConfig,
  conversationId,
  currentVote,
  onVote,
}: {
  turn: AgentTurn;
  isAgent1: boolean;
  agentConfig: AgentConfig | undefined;
  conversationId: string;
  currentVote: "up" | "down" | undefined;
  onVote: (turnNumber: number, vote: "up" | "down") => void;
}) {
  const accent = agentConfig?.accentColor ?? CYAN;
  const avatar = agentConfig?.avatar ?? "";

  const handleVoteClick = (vote: "up" | "down") => {
    onVote(turn.turnNumber, vote);
    // Only POST when adding or changing a vote, not when deselecting.
    if (currentVote !== vote) {
      fetch("/api/multi-agent/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          agentId: turn.agentId,
          turnNumber: turn.turnNumber,
          content: turn.content,
          vote,
        }),
      }).catch(() => {
        // Silent failure — voting should never crash the UI.
      });
    }
  };

  return (
    <div
      className={`flex items-start gap-2 ${isAgent1 ? "flex-row" : "flex-row-reverse"}`}
    >
      {/* Avatar */}
      <img
        src={`/${avatar}`}
        alt={turn.agentName}
        width={32}
        height={32}
        className="rounded-full shrink-0 object-cover mt-1"
        style={{ border: `2px solid ${accent}` }}
      />

      {/* Bubble content */}
      <div
        className={`flex flex-col gap-1 max-w-[75%] ${isAgent1 ? "items-start" : "items-end"}`}
      >
        {/* Name + turn badge */}
        <div className={`flex items-center gap-2 ${isAgent1 ? "" : "flex-row-reverse"}`}>
          <span
            className="text-xs font-semibold"
            style={{
              color: accent,
              fontFamily: "'Orbitron', system-ui, sans-serif",
              letterSpacing: "0.04em",
            }}
          >
            {turn.agentName}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{
              color: "hsl(var(--muted-foreground))",
              background: "hsl(var(--muted))",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            Turn {turn.turnNumber}
          </span>
        </div>

        {/* Message text */}
        <div
          className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
          style={{
            background: `${accent}14`,
            border: `1px solid ${accent}40`,
            color: "hsl(var(--foreground))",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            borderTopLeftRadius: isAgent1 ? "4px" : undefined,
            borderTopRightRadius: isAgent1 ? undefined : "4px",
          }}
        >
          {turn.content}
        </div>

        {/* Vote buttons — always visible */}
        <div className={`flex gap-1 ${isAgent1 ? "justify-start" : "justify-end"}`}>
          {(["up", "down"] as const).map((v) => {
            const isSelected = currentVote === v;
            const isOtherSelected = currentVote !== undefined && !isSelected;
            const Icon = v === "up" ? ThumbsUp : ThumbsDown;
            return (
              <button
                key={v}
                type="button"
                onClick={() => handleVoteClick(v)}
                aria-label={v === "up" ? "Thumbs up" : "Thumbs down"}
                className="rounded-md p-1 transition-all"
                style={{
                  background: isSelected ? CYAN : "transparent",
                  border: `1px solid ${isSelected ? CYAN : CYAN + "40"}`,
                  opacity: isOtherSelected ? 0.4 : 1,
                  cursor: "pointer",
                }}
              >
                <Icon size={14} color={CYAN} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── ConversationPanel ─────────────────────────────────────────────────────────

/**
 * Center panel that shows the empty state, live conversation, typing indicator,
 * and the post-conversation action buttons.
 */
function ConversationPanel({
  history,
  isRunning,
  isFinished,
  activeAgentId,
  agent1Id,
  agentMap,
  onContinue,
  onRedirect,
  onStop,
  error,
  conversationId,
  votes,
  onVote,
  onImprove,
  isImproving,
  improvementResults,
  improvementError,
}: {
  history: AgentTurn[];
  isRunning: boolean;
  isFinished: boolean;
  activeAgentId: string | null;
  agent1Id: string | null;
  agentMap: Record<string, AgentConfig>;
  onContinue: () => void;
  onRedirect: () => void;
  onStop: () => void;
  error: string | null;
  conversationId: string;
  votes: Record<number, "up" | "down">;
  onVote: (turnNumber: number, vote: "up" | "down") => void;
  onImprove: () => void;
  isImproving: boolean;
  improvementResults: ImprovementResult[] | null;
  improvementError: string | null;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever history grows or typing indicator changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length, isRunning]);

  const isEmpty = history.length === 0 && !isRunning;

  return (
    <div
      className="flex flex-1 flex-col rounded-xl overflow-hidden"
      style={{
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        minHeight: 0,
      }}
    >
      {isEmpty ? (
        /* Empty state */
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <Bot
            className="h-10 w-10"
            style={{
              color: "hsl(var(--muted-foreground))",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }`}</style>
          <p
            className="text-sm text-center max-w-[220px]"
            style={{
              color: "hsl(var(--muted-foreground))",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            Select two agents, enter a topic, and press Start
          </p>
        </div>
      ) : (
        /* Conversation list */
        <div className="flex flex-col flex-1 overflow-y-auto p-4 gap-4">
          {history.map((turn) => (
            <TurnBubble
              key={turn.turnNumber}
              turn={turn}
              isAgent1={turn.agentId === agent1Id}
              agentConfig={agentMap[turn.agentId]}
              conversationId={conversationId}
              currentVote={votes[turn.turnNumber]}
              onVote={onVote}
            />
          ))}

          {/* Typing indicator */}
          {isRunning && activeAgentId && (
            <div
              className={`flex items-center gap-2 ${activeAgentId === agent1Id ? "flex-row" : "flex-row-reverse"}`}
            >
              <img
                src={`/${agentMap[activeAgentId]?.avatar ?? ""}`}
                alt=""
                width={32}
                height={32}
                className="rounded-full shrink-0 object-cover"
                style={{ border: `2px solid ${agentMap[activeAgentId]?.accentColor ?? CYAN}` }}
              />
              <div
                className="rounded-xl px-3.5 py-2.5"
                style={{
                  background: `${agentMap[activeAgentId]?.accentColor ?? CYAN}14`,
                  border: `1px solid ${agentMap[activeAgentId]?.accentColor ?? CYAN}40`,
                }}
              >
                <TypingIndicator accentColor={agentMap[activeAgentId]?.accentColor ?? CYAN} />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p
              className="text-xs text-center"
              style={{ color: "#EF4444", fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              {error}
            </p>
          )}

          {/* Finished banner + actions */}
          {isFinished && (
            <div className="flex flex-col items-center gap-3 pt-2">
              <div
                className="w-full text-center text-sm font-semibold py-2 rounded-lg"
                style={{
                  background: `${CYAN}18`,
                  border: `1px solid ${CYAN}50`,
                  color: CYAN,
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                  letterSpacing: "0.05em",
                }}
              >
                Conversation complete
              </div>

              {/* Action buttons row */}
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { label: "Continue", action: onContinue, accent: CYAN },
                  { label: "Redirect", action: onRedirect, accent: "#A855F7" },
                  { label: "Stop", action: onStop, accent: "#EF4444" },
                ].map(({ label, action, accent }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{
                      background: `${accent}20`,
                      border: `1px solid ${accent}60`,
                      color: accent,
                      cursor: "pointer",
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}
                  >
                    {label}
                  </button>
                ))}

                {/* Improve Agents — hidden once results are available */}
                {improvementResults === null && (
                  <button
                    type="button"
                    disabled={isImproving}
                    onClick={isImproving ? undefined : onImprove}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{
                      background: `${CYAN}18`,
                      border: `1px solid ${CYAN}60`,
                      color: CYAN,
                      cursor: isImproving ? "not-allowed" : "pointer",
                      opacity: isImproving ? 0.6 : 1,
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}
                  >
                    {isImproving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Improve Agents
                  </button>
                )}
              </div>

              {/* Improvement error */}
              {improvementError && (
                <p
                  className="text-xs"
                  style={{ color: "#EF4444", fontFamily: "'DM Sans', system-ui, sans-serif" }}
                >
                  {improvementError}
                </p>
              )}

              {/* Improvement results */}
              {improvementResults !== null && (
                <div className="w-full flex flex-col gap-2">
                  {improvementResults.length === 0 ? (
                    /* Scores above threshold — no improvement needed */
                    <div
                      className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs"
                      style={{
                        background: "hsl(var(--muted))",
                        color: "hsl(var(--muted-foreground))",
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                      }}
                    >
                      <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "#22C55E" }} />
                      Agents are performing well — no improvements needed
                    </div>
                  ) : (
                    <>
                      {improvementResults.map((result) => {
                        const agent = agentMap[result.agentId];
                        const accent = agent?.accentColor ?? CYAN;
                        return (
                          <div
                            key={result.agentId}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                            style={{
                              background: `${accent}10`,
                              border: `1px solid ${accent}30`,
                            }}
                          >
                            {agent && (
                              <img
                                src={`/${agent.avatar}`}
                                alt={agent.name}
                                width={24}
                                height={24}
                                className="rounded-full shrink-0 object-cover"
                                style={{ border: `1.5px solid ${accent}` }}
                              />
                            )}
                            <span
                              className="text-xs font-semibold"
                              style={{ color: accent, fontFamily: "'DM Sans', system-ui, sans-serif" }}
                            >
                              {agent?.name ?? result.agentId}
                            </span>
                            <span
                              className="text-xs"
                              style={{ color: "hsl(var(--muted-foreground))", fontFamily: "'DM Sans', system-ui, sans-serif" }}
                            >
                              v{result.previousVersion} → v{result.newVersion}
                            </span>
                            <span
                              className="ml-auto text-xs px-2 py-0.5 rounded-full"
                              style={
                                result.triggerType === "user"
                                  ? { background: `${CYAN}20`, color: CYAN, border: `1px solid ${CYAN}50`, fontFamily: "'DM Sans', system-ui, sans-serif" }
                                  : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))", fontFamily: "'DM Sans', system-ui, sans-serif" }
                              }
                            >
                              {result.triggerType === "user" ? "user feedback" : "auto"}
                            </span>
                          </div>
                        );
                      })}
                      <p
                        className="text-center text-xs"
                        style={{ color: "hsl(var(--muted-foreground))", fontFamily: "'DM Sans', system-ui, sans-serif" }}
                      >
                        Improved prompts will be used in the next conversation
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

// ── AgentCard ─────────────────────────────────────────────────────────────────

/**
 * A single selectable agent card inside a selector panel.
 * @param agent - The agent configuration to display.
 * @param selected - Whether this card is currently selected.
 * @param disabled - Whether this card is unselectable.
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
      <img
        src={`/${agent.avatar}`}
        alt={agent.name}
        width={40}
        height={40}
        className="rounded-full shrink-0 object-cover"
        style={{ border: `2px solid ${selected ? accent : "transparent"}` }}
      />
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
 * @param disabledId - Agent id locked out (chosen on other side).
 * @param isLoading - True while the agent list is being fetched.
 * @param locked - True while a conversation is running; prevents selection changes.
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
  locked,
  onSelect,
  conflict,
}: {
  label: string;
  accentColor: string;
  agents: AgentConfig[];
  selectedId: string | null;
  disabledId: string | null;
  isLoading: boolean;
  locked: boolean;
  onSelect: (id: string) => void;
  conflict: boolean;
}) {
  return (
    <div
      className="flex flex-col rounded-xl w-[230px] shrink-0 overflow-hidden"
      style={{
        border: `2px solid ${accentColor}`,
        background: "hsl(var(--card))",
        opacity: locked ? 0.6 : 1,
        transition: "opacity 0.2s",
      }}
    >
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
              disabled={locked || disabledId === agent.id}
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
 * then watch them debate or collaborate for 6 sequential turns.
 */
export default function MultiAgentPage() {
  const [mode, setMode] = useState<"debate" | "collaborate">("debate");
  const [topic, setTopic] = useState("");
  const [agent1Id, setAgent1Id] = useState<string | null>(null);
  const [agent2Id, setAgent2Id] = useState<string | null>(null);
  const [conflict, setConflict] = useState<1 | 2 | null>(null);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  // Conversation state
  const [history, setHistory] = useState<AgentTurn[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>("");
  const [votes, setVotes] = useState<Record<number, "up" | "down">>({});
  const [isImproving, setIsImproving] = useState(false);
  const [improvementResults, setImprovementResults] = useState<ImprovementResult[] | null>(null);
  const [improvementError, setImprovementError] = useState<string | null>(null);

  const topicInputRef = useRef<HTMLInputElement>(null);

  // Fetch agents on mount
  useEffect(() => {
    fetch("/api/multi-agent/agents")
      .then((r) => r.json())
      .then((data: Record<string, AgentConfig>) => setAgents(Object.values(data)))
      .catch(console.error)
      .finally(() => setAgentsLoading(false));
  }, []);

  /** Quick lookup map from agent id → config. */
  const agentMap = agents.reduce<Record<string, AgentConfig>>((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {});

  /**
   * Runs `rounds` sequential turns starting from the provided history snapshot.
   * Turn parity: odd turns (1,3,5…) go to agent1, even turns (2,4,6…) go to agent2.
   * @param startHistory - History array at the point the run begins.
   * @param rounds - How many turns to execute (default 6).
   */
  const runTurns = useCallback(
    async (startHistory: AgentTurn[], rounds = 6) => {
      if (!agent1Id || !agent2Id) return;

      setIsRunning(true);
      setIsFinished(false);
      setError(null);

      let currentHistory = startHistory;

      try {
        for (let i = 0; i < rounds; i++) {
          const turnNumber = currentHistory.length + 1;
          // Odd turns → agent1, even turns → agent2
          const currentAgentId = turnNumber % 2 === 1 ? agent1Id : agent2Id;
          setActiveAgentId(currentAgentId);

          const res = await fetch("/api/multi-agent/turn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agent1Id,
              agent2Id,
              mode,
              topic,
              history: currentHistory,
              currentAgentId,
              model: "llama-3.3-70b-versatile",
            }),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error((body as { error?: string }).error ?? "Failed to get agent response");
          }

          const turn: AgentTurn = await res.json();
          currentHistory = [...currentHistory, turn];
          setHistory(currentHistory);
          setTurnCount(currentHistory.length);
        }

        setIsFinished(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setIsRunning(false);
        setActiveAgentId(null);
      }
    },
    [agent1Id, agent2Id, mode, topic]
  );

  /**
   * Toggles a vote on a turn. Clicking the same vote again deselects it.
   * @param turnNumber - The turn being voted on.
   * @param vote - "up" or "down".
   */
  const handleVote = (turnNumber: number, vote: "up" | "down") => {
    setVotes((prev) => {
      if (prev[turnNumber] === vote) {
        const next = { ...prev };
        delete next[turnNumber];
        return next;
      }
      return { ...prev, [turnNumber]: vote };
    });
  };

  /**
   * Sends the completed conversation to the improvement endpoint.
   * Auto-scores all turns and optionally generates improved prompts
   * for agents that underperformed or received negative feedback.
   */
  const handleImprove = async () => {
    setIsImproving(true);
    setImprovementError(null);
    try {
      const res = await fetch("/api/multi-agent/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          turns: history,
          model: "llama-3.3-70b-versatile",
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json() as { improved: boolean; results?: ImprovementResult[] };
      // Empty array signals "improved: false" (scores above threshold).
      setImprovementResults(data.improved ? (data.results ?? []) : []);
    } catch {
      setImprovementError("Improvement failed, please try again");
    } finally {
      setIsImproving(false);
    }
  };

  /** Starts a fresh 6-turn conversation. */
  const handleStart = () => {
    setHistory([]);
    setTurnCount(0);
    setIsFinished(false);
    setVotes({});
    setImprovementResults(null);
    setImprovementError(null);
    setConversationId(crypto.randomUUID());
    runTurns([]);
  };

  /** Continues from the current history for 6 more turns. */
  const handleContinue = () => {
    runTurns(history);
  };

  /** Clears history and topic but keeps the selected agents. */
  const handleRedirect = () => {
    setHistory([]);
    setTurnCount(0);
    setIsFinished(false);
    setError(null);
    setTopic("");
    setTimeout(() => topicInputRef.current?.focus(), 50);
  };

  /** Resets everything back to the initial empty state. */
  const handleStop = () => {
    setHistory([]);
    setTurnCount(0);
    setIsRunning(false);
    setIsFinished(false);
    setActiveAgentId(null);
    setError(null);
    setTopic("");
    setAgent1Id(null);
    setAgent2Id(null);
  };

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

  const canStart = !!agent1Id && !!agent2Id && topic.trim().length > 0 && !isRunning;

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        className="relative flex items-center px-6 py-4 shrink-0"
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

        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
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

        {/* Live turn counter */}
        {(isRunning || isFinished) && (
          <div
            className="ml-auto flex items-center gap-2 text-xs px-3 py-1.5 rounded-full shrink-0"
            style={{
              background: `${CYAN}18`,
              border: `1px solid ${CYAN}40`,
              color: CYAN,
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            {isRunning && <Loader2 className="h-3 w-3 animate-spin" />}
            {isFinished ? `${turnCount} turns` : `Turn ${turnCount + 1} of 6…`}
          </div>
        )}
      </header>

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden min-h-0">

        <AgentSelectorPanel
          label="Agent 1"
          accentColor={CYAN}
          agents={agents}
          selectedId={agent1Id}
          disabledId={agent2Id}
          isLoading={agentsLoading}
          locked={isRunning}
          onSelect={handleSelectAgent1}
          conflict={conflict === 1}
        />

        <ConversationPanel
          history={history}
          isRunning={isRunning}
          isFinished={isFinished}
          activeAgentId={activeAgentId}
          agent1Id={agent1Id}
          agentMap={agentMap}
          onContinue={handleContinue}
          onRedirect={handleRedirect}
          onStop={handleStop}
          error={error}
          conversationId={conversationId}
          votes={votes}
          onVote={handleVote}
          onImprove={handleImprove}
          isImproving={isImproving}
          improvementResults={improvementResults}
          improvementError={improvementError}
        />

        <AgentSelectorPanel
          label="Agent 2"
          accentColor={BLUE}
          agents={agents}
          selectedId={agent2Id}
          disabledId={agent1Id}
          isLoading={agentsLoading}
          locked={isRunning}
          onSelect={handleSelectAgent2}
          conflict={conflict === 2}
        />
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderTop: "1px solid hsl(var(--border))" }}
      >
        <input
          ref={topicInputRef}
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={isRunning}
          placeholder="Enter a topic or question..."
          className="flex-1 rounded-lg px-4 py-2 text-sm outline-none transition-colors"
          style={{
            background: "hsl(var(--input))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--foreground))",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            opacity: isRunning ? 0.5 : 1,
          }}
          onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = CYAN; }}
          onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))"; }}
        />

        <div
          className="flex rounded-lg overflow-hidden shrink-0"
          style={{ border: "1px solid hsl(var(--border))", opacity: isRunning ? 0.5 : 1 }}
        >
          {(["debate", "collaborate"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => !isRunning && setMode(m)}
              className="px-4 py-2 text-sm font-medium capitalize"
              style={{
                background: mode === m ? CYAN : "hsl(var(--card))",
                color: mode === m ? "hsl(var(--background))" : "hsl(var(--muted-foreground))",
                border: "none",
                cursor: isRunning ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!canStart}
          onClick={canStart ? handleStart : undefined}
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
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Start"}
        </button>
      </div>
    </div>
  );
}
