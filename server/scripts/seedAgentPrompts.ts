import "dotenv/config";
import { getLatestPrompt, insertPrompt } from "../agentPromptQueries";
import { AGENTS } from "../services/multi-agent.service";

/**
 * Idempotent seed script — inserts version 1 system prompts for every
 * multi-agent AGENT config. Skips any agent that already has a version 1 row.
 *
 * Run with: npm run seed:agents
 */
async function main(): Promise<void> {
  const agents = Object.values(AGENTS);

  for (const agent of agents) {
    const existing = await getLatestPrompt(agent.id);
    const alreadySeeded = existing !== undefined && existing.version === 1;

    if (alreadySeeded) {
      console.log(`Skipped ${agent.name} (already exists)`);
      continue;
    }

    await insertPrompt({
      agentId: agent.id,
      prompt: agent.systemPrompt,
      version: 1,
      triggerType: "initial",
    });

    console.log(`Seeded ${agent.name} v1`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
