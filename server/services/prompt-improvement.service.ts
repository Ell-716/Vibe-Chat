import OpenAI from "openai";
import { env } from "../config/env";
import { getLatestPrompt, insertPrompt } from "../agentPromptQueries";
import { AGENTS, type AgentTurn } from "./multi-agent.service";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** A single thumbs-up or thumbs-down vote on an agent's turn by the user. */
export type FeedbackSignal = {
  turnNumber: number;
  agentId: string;
  content: string;
  vote: "up" | "down";
};

/** LLM-generated quality scores for a single agent turn. */
export type AutoScore = {
  turnNumber: number;
  agentId: string;
  content: string;
  /** How clear and well-structured the response is (1–5). */
  clarity: number;
  /** How well the response reflects the agent's role and personality (1–5). */
  personalityAccuracy: number;
  /** How relevant the response is to the conversation topic (1–5). */
  relevance: number;
};

/** Result returned after a prompt improvement cycle. */
export type ImprovementResult = {
  agentId: string;
  previousVersion: number;
  newVersion: number;
  newPrompt: string;
  triggerType: "user" | "auto";
};

// ---------------------------------------------------------------------------
// Groq client (lazy singleton)
// ---------------------------------------------------------------------------

let _groq: OpenAI | null = null;

/**
 * Returns the shared Groq OpenAI-compatible client, initialising it on first use.
 * @returns Configured OpenAI client pointed at the Groq endpoint.
 */
function getGroq(): OpenAI {
  if (!_groq) {
    if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");
    _groq = new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 30_000,
    });
  }
  return _groq;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a model string, falling back to the default Groq model when blank.
 * @param model - Caller-supplied model id, possibly empty.
 * @returns A non-empty model id string.
 */
function resolveModel(model: string): string {
  return model && model.trim() !== "" ? model : env.GROQ_MODEL;
}

/**
 * Strips markdown code fences that some models wrap around JSON output.
 * @param raw - Raw LLM response string.
 * @returns Cleaned string ready for JSON.parse.
 */
function stripCodeFences(raw: string): string {
  return raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
}

// ---------------------------------------------------------------------------
// autoScoreTurns
// ---------------------------------------------------------------------------

/**
 * Calls the LLM to evaluate each turn on clarity, personalityAccuracy, and
 * relevance. Turns with empty content are skipped. All scoring requests are
 * made in parallel.
 *
 * @param turns - The completed conversation turns to score.
 * @param model - LLM model id to use for scoring.
 * @returns Array of AutoScore objects, one per non-empty turn.
 */
export async function autoScoreTurns(
  turns: AgentTurn[],
  model: string
): Promise<AutoScore[]> {
  const resolved = resolveModel(model);
  const activeTurns = turns.filter((t) => t.content.trim() !== "");

  return Promise.all(
    activeTurns.map(async (turn): Promise<AutoScore> => {
      const agentSystemPrompt =
        AGENTS[turn.agentId]?.systemPrompt ?? "Unknown agent";

      const prompt =
        `You are an AI evaluator. Score this agent response on three dimensions from 1 to 5:\n` +
        `- clarity: how clear and well-structured is the response?\n` +
        `- personalityAccuracy: how well does it reflect the agent's role and personality?\n` +
        `- relevance: how relevant is it to the topic?\n\n` +
        `Agent role: ${agentSystemPrompt}\n` +
        `Response: ${turn.content}\n\n` +
        `Reply with JSON only:\n` +
        `{ "clarity": N, "personalityAccuracy": N, "relevance": N }`;

      const response = await getGroq().chat.completions.create({
        model: resolved,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 64,
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(stripCodeFences(raw)) as {
        clarity: number;
        personalityAccuracy: number;
        relevance: number;
      };

      return {
        turnNumber: turn.turnNumber,
        agentId: turn.agentId,
        content: turn.content,
        clarity: parsed.clarity,
        personalityAccuracy: parsed.personalityAccuracy,
        relevance: parsed.relevance,
      };
    })
  );
}

// ---------------------------------------------------------------------------
// improvePrompt
// ---------------------------------------------------------------------------

/**
 * Generates and persists an improved system prompt for an agent by combining
 * user vote feedback with LLM auto-scores.
 *
 * Fetches the current prompt, summarises all feedback signals and auto-scores,
 * asks the LLM to produce an improved prompt, then inserts it as the next
 * version row in agent_prompts.
 *
 * @param agentId - The agent whose prompt should be improved.
 * @param feedbackSignals - Thumbs-up/down votes collected from the conversation.
 * @param autoScores - LLM-generated scores produced by autoScoreTurns.
 * @param model - LLM model id to use for prompt generation.
 * @param triggerType - Whether this improvement was user-initiated or automatic.
 * @returns An ImprovementResult describing the old and new version details.
 */
export async function improvePrompt(
  agentId: string,
  feedbackSignals: FeedbackSignal[],
  autoScores: AutoScore[],
  model: string,
  triggerType: "user" | "auto"
): Promise<ImprovementResult> {
  const current = await getLatestPrompt(agentId);
  if (!current) {
    throw new Error(`No existing prompt found for agent: ${agentId}`);
  }

  const resolved = resolveModel(model);

  // ── Vote counts ────────────────────────────────────────────────────────────
  const upCount = feedbackSignals.filter((s) => s.vote === "up").length;
  const downCount = feedbackSignals.filter((s) => s.vote === "down").length;

  // ── Average scores across all dimensions ──────────────────────────────────
  const avg = (key: keyof Pick<AutoScore, "clarity" | "personalityAccuracy" | "relevance">) =>
    autoScores.length > 0
      ? (autoScores.reduce((sum, s) => sum + s[key], 0) / autoScores.length).toFixed(1)
      : "N/A";

  const avgClarity = avg("clarity");
  const avgPersonality = avg("personalityAccuracy");
  const avgRelevance = avg("relevance");

  // ── Weak turns: downvoted by the user ─────────────────────────────────────
  const downvotedLines = feedbackSignals
    .filter((s) => s.vote === "down")
    .map((s) => `- "${s.content}"`)
    .join("\n");

  // ── Weak turns: average auto-score below 3 ────────────────────────────────
  const lowScoringLines = autoScores
    .filter((s) => (s.clarity + s.personalityAccuracy + s.relevance) / 3 < 3)
    .map((s) => `- "${s.content}"`)
    .join("\n");

  const weakTurns =
    [downvotedLines, lowScoringLines].filter(Boolean).join("\n") || "(none)";

  const improvementPrompt =
    `You are an AI prompt engineer. Your task is to improve an AI agent's system prompt based on conversation feedback.\n\n` +
    `Current prompt:\n${current.prompt}\n\n` +
    `Feedback summary:\n` +
    `- User votes: ${upCount} 👍 / ${downCount} 👎\n` +
    `- Average clarity: ${avgClarity}/5\n` +
    `- Average personality accuracy: ${avgPersonality}/5\n` +
    `- Average relevance: ${avgRelevance}/5\n\n` +
    `Weak responses that received negative feedback:\n${weakTurns}\n\n` +
    `Write an improved version of the system prompt that addresses these weaknesses while preserving the agent's core personality and role.\n` +
    `Return the improved prompt text only — no explanation, no preamble.`;

  const response = await getGroq().chat.completions.create({
    model: resolved,
    messages: [{ role: "user", content: improvementPrompt }],
    max_tokens: 512,
  });

  const newPrompt = (response.choices[0]?.message?.content ?? "").trim();
  const newVersion = current.version + 1;

  await insertPrompt({ agentId, prompt: newPrompt, version: newVersion, triggerType });

  return {
    agentId,
    previousVersion: current.version,
    newVersion,
    newPrompt,
    triggerType,
  };
}

// ---------------------------------------------------------------------------
// shouldAutoImprove
// ---------------------------------------------------------------------------

/**
 * Determines whether automatic prompt improvement should be triggered based
 * on the average quality score across all turns and dimensions.
 *
 * Returns true when the mean of all clarity, personalityAccuracy, and relevance
 * scores falls below 3.5, indicating the agent is underperforming.
 *
 * @param autoScores - LLM-generated scores produced by autoScoreTurns.
 * @returns True if the average score is below 3.5, false otherwise.
 */
export function shouldAutoImprove(autoScores: AutoScore[]): boolean {
  if (autoScores.length === 0) return false;
  const total = autoScores.reduce(
    (sum, s) => sum + s.clarity + s.personalityAccuracy + s.relevance,
    0
  );
  const average = total / (autoScores.length * 3);
  return average < 3.5;
}
