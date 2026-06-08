import type { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import { storage } from "../storage";

/**
 * GET /api/agents
 * Returns all AI agents (built-in defaults + user-created).
 */
export async function getAgents(req: Request, res: Response): Promise<void> {
  try {
    const agents = await storage.getAllAgents();
    res.json(agents);
  } catch (error) {
    logger.error({ err: error }, "Error fetching agents");
    res.status(500).json({ error: "Failed to fetch agents" });
  }
}

/**
 * GET /api/agents/:id
 * Returns a single agent by ID.
 */
export async function getAgent(req: Request, res: Response): Promise<void> {
  try {
    const agent = await storage.getAgent(req.params.id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(agent);
  } catch (error) {
    logger.error({ err: error }, "Error fetching agent");
    res.status(500).json({ error: "Failed to fetch agent" });
  }
}

/**
 * POST /api/agents
 * Creates a new custom agent with a name, optional description, system prompt, and icon.
 * @param req.body.name - Agent display name (required).
 * @param req.body.systemPrompt - The system prompt that defines the agent's persona (required).
 * @param req.body.description - Optional agent description shown in the selector.
 * @param req.body.icon - Optional icon identifier. Defaults to "bot".
 */
export async function createAgent(req: Request, res: Response): Promise<void> {
  try {
    const { name, description, systemPrompt, icon } = req.body;
    if (!name || !systemPrompt) {
      res.status(400).json({ error: "Name and system prompt are required" });
      return;
    }
    const agent = await storage.createAgent({
      name,
      description: description || "",
      systemPrompt,
      icon: icon || "bot",
    });
    res.status(201).json(agent);
  } catch (error) {
    logger.error({ err: error }, "Error creating agent");
    res.status(500).json({ error: "Failed to create agent" });
  }
}

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().max(32000).optional(),
  icon: z.string().max(50).optional(),
});

/**
 * PATCH /api/agents/:id
 * Partially updates an existing agent's fields.
 * isDefault is explicitly stripped and cannot be overwritten via this route.
 * @param req.body - Any subset of { name, description, systemPrompt, icon } to update.
 */
export async function updateAgent(req: Request, res: Response): Promise<void> {
  const parsed = updateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const agent = await storage.updateAgent(req.params.id, parsed.data);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(agent);
  } catch (error) {
    logger.error({ err: error }, "Error updating agent");
    res.status(500).json({ error: "Failed to update agent" });
  }
}

/**
 * DELETE /api/agents/:id
 * Deletes a custom agent. Default (built-in) agents are silently protected by storage.
 */
export async function deleteAgent(req: Request, res: Response): Promise<void> {
  try {
    await storage.deleteAgent(req.params.id);
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, "Error deleting agent");
    res.status(500).json({ error: "Failed to delete agent" });
  }
}
