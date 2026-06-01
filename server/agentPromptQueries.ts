import { eq, desc, asc } from "drizzle-orm";
import { db } from "./db";
import { agentPrompts } from "@shared/schema";
import type { AgentPrompt, InsertAgentPrompt } from "@shared/schema";

/**
 * Returns the row with the highest version for the given agentId.
 * @param agentId - The agent identifier (e.g. "general_assistant").
 * @returns The latest AgentPrompt row, or undefined if none exists.
 */
export async function getLatestPrompt(agentId: string): Promise<AgentPrompt | undefined> {
  const rows = await db
    .select()
    .from(agentPrompts)
    .where(eq(agentPrompts.agentId, agentId))
    .orderBy(desc(agentPrompts.version))
    .limit(1);
  return rows[0];
}

/**
 * Inserts a new agent_prompts row and returns the created record.
 * @param data - Prompt data excluding auto-generated id and createdAt.
 * @returns The newly inserted AgentPrompt row.
 */
export async function insertPrompt(data: InsertAgentPrompt): Promise<AgentPrompt> {
  const rows = await db.insert(agentPrompts).values(data).returning();
  return rows[0];
}

/**
 * Returns all prompt versions for the given agentId, ordered by version ascending.
 * @param agentId - The agent identifier (e.g. "general_assistant").
 * @returns Array of AgentPrompt rows from oldest to newest version.
 */
export async function getPromptHistory(agentId: string): Promise<AgentPrompt[]> {
  return db
    .select()
    .from(agentPrompts)
    .where(eq(agentPrompts.agentId, agentId))
    .orderBy(asc(agentPrompts.version));
}
