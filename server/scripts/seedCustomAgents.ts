import "dotenv/config";
import { db } from "../db";
import { agents } from "@shared/schema";

/**
 * Custom agent definitions to seed.
 * Fixed IDs make the script idempotent — existing rows are upserted so icon
 * changes are applied even if the agent was previously inserted.
 */
const CUSTOM_AGENTS = [
  {
    id: "debate-coach",
    name: "Debate Coach",
    description: "Structures arguments and identifies logical fallacies",
    systemPrompt:
      "You are an expert debate coach with deep knowledge of rhetoric, logic, and argumentation. You help structure clear arguments, identify logical fallacies, challenge weak reasoning, and strengthen positions with evidence. You are direct, rigorous, and push for intellectual precision.",
    icon: "scale",
    isDefault: false,
  },
  {
    id: "career-advisor",
    name: "Career Advisor",
    description: "Guides career decisions, CV advice and interview preparation",
    systemPrompt:
      "You are an experienced career advisor with expertise in job searching, CV writing, interview preparation, and career strategy. You give practical, actionable advice tailored to the individual's background and goals. You are encouraging but honest about what it takes to succeed.",
    icon: "briefcase",
    isDefault: false,
  },
];

/**
 * Upserts the two example custom agents into the agents table.
 * On conflict (same id), all fields are updated so re-running picks up changes.
 *
 * Run with: npm run seed:custom-agents
 */
async function main(): Promise<void> {
  for (const agent of CUSTOM_AGENTS) {
    await db
      .insert(agents)
      .values(agent)
      .onConflictDoUpdate({
        target: agents.id,
        set: {
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          icon: agent.icon,
        },
      });
    console.log(`Upserted ${agent.name}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
