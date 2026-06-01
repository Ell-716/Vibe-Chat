import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { agents } from "@shared/schema";

/**
 * Custom agent definitions to seed.
 * Fixed IDs make the script idempotent — existing rows are skipped.
 */
const CUSTOM_AGENTS = [
  {
    id: "debate-coach",
    name: "Debate Coach",
    description: "Structures arguments and identifies logical fallacies",
    systemPrompt:
      "You are an expert debate coach with deep knowledge of rhetoric, logic, and argumentation. You help structure clear arguments, identify logical fallacies, challenge weak reasoning, and strengthen positions with evidence. You are direct, rigorous, and push for intellectual precision.",
    icon: "pen-tool",
    isDefault: false,
  },
  {
    id: "career-advisor",
    name: "Career Advisor",
    description: "Guides career decisions, CV advice and interview preparation",
    systemPrompt:
      "You are an experienced career advisor with expertise in job searching, CV writing, interview preparation, and career strategy. You give practical, actionable advice tailored to the individual's background and goals. You are encouraging but honest about what it takes to succeed.",
    icon: "bar-chart",
    isDefault: false,
  },
];

/**
 * Idempotent seed script — inserts example custom agents into the agents table.
 * Skips any agent whose ID already exists.
 *
 * Run with: npm run seed:custom-agents
 */
async function main(): Promise<void> {
  for (const agent of CUSTOM_AGENTS) {
    const existing = await db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.id, agent.id))
      .limit(1);

    if (existing.length > 0) {
      console.log(`Skipped ${agent.name} (already exists)`);
      continue;
    }

    await db.insert(agents).values(agent);
    console.log(`Seeded ${agent.name}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
