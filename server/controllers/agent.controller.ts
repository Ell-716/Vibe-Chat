import type { Request, Response } from "express";
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
    console.error("Error fetching agents:", error);
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
    console.error("Error fetching agent:", error);
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
    console.error("Error creating agent:", error);
    res.status(500).json({ error: "Failed to create agent" });
  }
}

/**
 * PATCH /api/agents/:id
 * Partially updates an existing agent's fields.
 * @param req.body - Any subset of Agent fields to update.
 */
export async function updateAgent(req: Request, res: Response): Promise<void> {
  try {
    const agent = await storage.updateAgent(req.params.id, req.body);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(agent);
  } catch (error) {
    console.error("Error updating agent:", error);
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
    console.error("Error deleting agent:", error);
    res.status(500).json({ error: "Failed to delete agent" });
  }
}
