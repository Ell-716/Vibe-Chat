import type { Request, Response } from "express";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import {
  AGENTS,
  runAgentTurn,
  type AgentTurn,
  type MultiAgentMode,
  type MultiAgentRequest,
} from "../services/multi-agent.service";

// ─── GET /api/multi-agent/agents ─────────────────────────────────────────────

/**
 * GET /api/multi-agent/agents
 * Returns the static list of all available multi-agent participants.
 * Public — no authentication required.
 */
export async function getAgentConfigs(
  _req: Request,
  res: Response
): Promise<void> {
  res.json(AGENTS);
}

// ─── POST /api/multi-agent/turn ──────────────────────────────────────────────

/**
 * POST /api/multi-agent/turn
 * Runs a single agent turn in a multi-agent conversation and returns the result.
 *
 * @param req.body.agent1Id - ID of the first conversation participant.
 * @param req.body.agent2Id - ID of the second conversation participant.
 * @param req.body.mode - Interaction mode: "debate" or "collaborate".
 * @param req.body.topic - The subject both agents are discussing.
 * @param req.body.history - Array of AgentTurn objects representing prior turns.
 * @param req.body.currentAgentId - Which agent should speak this turn.
 * @param req.body.model - Optional LLM model override.
 * @returns 200 with the new AgentTurn, or 400/500 on validation/runtime error.
 */
export async function runTurn(req: Request, res: Response): Promise<void> {
  const { agent1Id, agent2Id, mode, topic, history, currentAgentId, model } =
    req.body as {
      agent1Id?: string;
      agent2Id?: string;
      mode?: MultiAgentMode;
      topic?: string;
      history?: AgentTurn[];
      currentAgentId?: string;
      model?: string;
    };

  // ── Presence validation ────────────────────────────────────────────────────
  if (!agent1Id || !agent2Id || !currentAgentId || !topic || !mode) {
    res.status(400).json({
      error: "agent1Id, agent2Id, currentAgentId, topic, and mode are required",
    });
    return;
  }

  // ── Mode validation ────────────────────────────────────────────────────────
  if (mode !== "debate" && mode !== "collaborate") {
    res.status(400).json({ error: 'mode must be "debate" or "collaborate"' });
    return;
  }

  // ── currentAgentId must be one of the two participants ────────────────────
  if (currentAgentId !== agent1Id && currentAgentId !== agent2Id) {
    res.status(400).json({
      error: "currentAgentId must be either agent1Id or agent2Id",
    });
    return;
  }

  // ── Both agent IDs must exist in the AGENTS registry ─────────────────────
  if (!AGENTS[agent1Id]) {
    res.status(400).json({ error: `Unknown agent: ${agent1Id}` });
    return;
  }
  if (!AGENTS[agent2Id]) {
    res.status(400).json({ error: `Unknown agent: ${agent2Id}` });
    return;
  }

  try {
    const request: MultiAgentRequest = {
      agent1Id,
      agent2Id,
      mode,
      topic,
      history: Array.isArray(history) ? history : [],
    };

    const turn = await runAgentTurn(
      request,
      currentAgentId,
      model ?? env.GROQ_MODEL
    );

    res.json(turn);
  } catch (error) {
    logger.error({ err: error }, "Error running multi-agent turn");
    res.status(500).json({ error: "Failed to run agent turn" });
  }
}
