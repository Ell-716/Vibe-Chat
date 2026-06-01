import type { Request, Response } from "express";
import { AGENTS, type AgentTurn } from "../services/multi-agent.service";
import {
  autoScoreTurns,
  improvePrompt,
  shouldAutoImprove,
  type FeedbackSignal,
  type ImprovementResult,
} from "../services/prompt-improvement.service";
import { getPromptHistory } from "../agentPromptQueries";

// ---------------------------------------------------------------------------
// In-memory feedback store
// ---------------------------------------------------------------------------

/**
 * Stores per-conversation feedback signals in memory.
 * Key: client-generated conversationId.
 * Value: array of FeedbackSignal objects for that session.
 */
const feedbackStore = new Map<string, FeedbackSignal[]>();

// ---------------------------------------------------------------------------
// POST /api/multi-agent/feedback
// ---------------------------------------------------------------------------

/**
 * Records a single thumbs-up or thumbs-down vote on an agent's turn.
 * Signals are stored in the in-memory feedbackStore, keyed by conversationId.
 *
 * @param req.body.conversationId - Client-generated UUID for the session.
 * @param req.body.agentId - The agent whose turn is being rated.
 * @param req.body.turnNumber - The 1-based turn index within the conversation.
 * @param req.body.content - The full text of the turn being rated.
 * @param req.body.vote - "up" or "down".
 * @returns 200 { received: true } on success, or 400 on validation failure.
 */
export async function submitFeedback(req: Request, res: Response): Promise<void> {
  const { conversationId, agentId, turnNumber, content, vote } = req.body as {
    conversationId?: string;
    agentId?: string;
    turnNumber?: number;
    content?: string;
    vote?: string;
  };

  // ── Presence validation ────────────────────────────────────────────────────
  if (!conversationId || !agentId || turnNumber == null || !content || !vote) {
    res.status(400).json({
      error: "conversationId, agentId, turnNumber, content, and vote are required",
    });
    return;
  }

  // ── agentId must exist in the AGENTS registry ─────────────────────────────
  if (!AGENTS[agentId]) {
    res.status(400).json({ error: `Unknown agent: ${agentId}` });
    return;
  }

  // ── vote must be "up" or "down" ────────────────────────────────────────────
  if (vote !== "up" && vote !== "down") {
    res.status(400).json({ error: 'vote must be "up" or "down"' });
    return;
  }

  const signal: FeedbackSignal = {
    turnNumber,
    agentId,
    content,
    vote,
  };

  const existing = feedbackStore.get(conversationId) ?? [];
  feedbackStore.set(conversationId, [...existing, signal]);

  res.json({ received: true });
}

// ---------------------------------------------------------------------------
// POST /api/multi-agent/improve
// ---------------------------------------------------------------------------

/**
 * Runs a prompt improvement cycle for all agents that participated in a
 * conversation, using stored feedback signals and LLM-generated auto-scores.
 *
 * Improvement is skipped when auto-scores are above the threshold AND the user
 * has not submitted any feedback votes. Otherwise, each agent with votes or
 * low scores receives an improved prompt version persisted to the database.
 *
 * @param req.body.conversationId - Session UUID used to look up stored feedback.
 * @param req.body.turns - Complete list of AgentTurn objects from the conversation.
 * @param req.body.model - Optional LLM model id; defaults to llama-3.3-70b-versatile.
 * @returns 200 { improved: false, reason } when skipped, or
 *          200 { improved: true, results: ImprovementResult[] } otherwise.
 */
export async function runImprovement(req: Request, res: Response): Promise<void> {
  const { conversationId, turns, model } = req.body as {
    conversationId?: string;
    turns?: AgentTurn[];
    model?: string;
  };

  // ── Presence validation ────────────────────────────────────────────────────
  if (!conversationId || !Array.isArray(turns) || turns.length === 0) {
    res.status(400).json({ error: "conversationId and a non-empty turns array are required" });
    return;
  }

  const resolvedModel = model && model.trim() !== "" ? model : "llama-3.3-70b-versatile";
  const storedFeedback = feedbackStore.get(conversationId) ?? [];

  try {
    // ── Auto-score all turns ───────────────────────────────────────────────────
    const autoScores = await autoScoreTurns(turns, resolvedModel);

    // ── Early-exit: scores fine and no user votes submitted ───────────────────
    if (!shouldAutoImprove(autoScores) && storedFeedback.length === 0) {
      res.json({ improved: false, reason: "scores above threshold" });
      return;
    }

    // ── Collect unique agent ids that need improvement ────────────────────────
    // An agent qualifies if it has any user votes OR its own scores are below
    // the auto-improve threshold.
    const allAgentIds = [...new Set(turns.map((t) => t.agentId))];

    const agentsToImprove = allAgentIds.filter((agentId) => {
      const hasFeedback = storedFeedback.some((s) => s.agentId === agentId);
      const agentScores = autoScores.filter((s) => s.agentId === agentId);
      const hasLowScores = shouldAutoImprove(agentScores);
      return hasFeedback || hasLowScores;
    });

    // ── Run improvement for each qualifying agent ─────────────────────────────
    const results: ImprovementResult[] = await Promise.all(
      agentsToImprove.map((agentId) => {
        const agentFeedback = storedFeedback.filter((s) => s.agentId === agentId);
        const agentScores = autoScores.filter((s) => s.agentId === agentId);
        // Use "user" trigger if the agent received any explicit votes.
        const triggerType = agentFeedback.length > 0 ? "user" : "auto";
        return improvePrompt(agentId, agentFeedback, agentScores, resolvedModel, triggerType);
      })
    );

    // ── Clear stored feedback for this conversation ───────────────────────────
    feedbackStore.delete(conversationId);

    res.json({ improved: true, results });
  } catch (error) {
    console.error("Error running prompt improvement:", error);
    res.status(500).json({ error: "Failed to run prompt improvement" });
  }
}

// ---------------------------------------------------------------------------
// GET /api/multi-agent/agents/:agentId/prompt-history
// ---------------------------------------------------------------------------

/**
 * Returns the full version history of system prompts for a given agent,
 * ordered from oldest (v1) to newest.
 *
 * @param req.params.agentId - The agent whose prompt history to retrieve.
 * @returns 200 with an array of AgentPrompt rows, or 400 for unknown agents.
 */
export async function getAgentPromptHistory(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;

  if (!AGENTS[agentId]) {
    res.status(400).json({ error: `Unknown agent: ${agentId}` });
    return;
  }

  try {
    const history = await getPromptHistory(agentId);
    res.json(history);
  } catch (error) {
    console.error("Error fetching prompt history:", error);
    res.status(500).json({ error: "Failed to fetch prompt history" });
  }
}
