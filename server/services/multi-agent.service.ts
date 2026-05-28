import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { env } from "../config/env";

// ---------------------------------------------------------------------------
// Agent definitions
// ---------------------------------------------------------------------------

/** Configuration for a single multi-agent participant. */
export type AgentConfig = {
  /** Unique identifier used to look up the agent. */
  id: string;
  /** Display name shown in the UI. */
  name: string;
  /** Filename of the avatar image located in client/public/. */
  avatar: string;
  /** CSS hex color used to tint the agent's UI elements. */
  accentColor: string;
  /** Base personality / system prompt for the agent. */
  systemPrompt: string;
};

/** All available multi-agent participants keyed by their id. */
export const AGENTS: Record<string, AgentConfig> = {
  general_assistant: {
    id: "general_assistant",
    name: "General Assistant",
    avatar: "general_assistant.png",
    accentColor: "#00B4D8",
    systemPrompt:
      "You are a balanced, helpful assistant. You approach every topic thoughtfully, weigh different perspectives fairly, and aim to be genuinely useful. You communicate clearly and adapt your tone to the conversation.",
  },
  creative_writer: {
    id: "creative_writer",
    name: "Creative Writer",
    avatar: "creative_writer.png",
    accentColor: "#A855F7",
    systemPrompt:
      "You are an imaginative storyteller who thinks in metaphors, narratives, and vivid imagery. You see every topic as a story waiting to be told. You draw on emotion, symbolism, and human experience to make ideas come alive.",
  },
  data_analyst: {
    id: "data_analyst",
    name: "Data Analyst",
    avatar: "data_analyst.png",
    accentColor: "#F97316",
    systemPrompt:
      "You are a precise analytical thinker who reasons with data, evidence, and logic. You challenge assumptions, look for patterns, quantify uncertainty, and back every claim with reasoning. You prefer specifics over generalities.",
  },
  learning_tutor: {
    id: "learning_tutor",
    name: "Learning Tutor",
    avatar: "learning_tutor.png",
    accentColor: "#22C55E",
    systemPrompt:
      "You are a patient, encouraging teacher who excels at breaking complex ideas into clear, digestible steps. You use analogies, examples, and questions to guide understanding. You never talk down to learners — you meet them where they are.",
  },
  code_expert: {
    id: "code_expert",
    name: "Code Expert",
    avatar: "code_expert.png",
    accentColor: "#3B82F6",
    systemPrompt:
      "You are a technical expert who thinks in systems, patterns, and clean code. You reason about architecture, trade-offs, and maintainability. You are direct and precise, and you back your recommendations with engineering principles.",
  },
};

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** A single spoken turn by one agent in a multi-agent conversation. */
export type AgentTurn = {
  agentId: string;
  agentName: string;
  content: string;
  turnNumber: number;
};

/** How the two agents interact with each other. */
export type MultiAgentMode = "debate" | "collaborate";

/** Full request payload for a multi-agent conversation turn. */
export type MultiAgentRequest = {
  agent1Id: string;
  agent2Id: string;
  mode: MultiAgentMode;
  topic: string;
  history: AgentTurn[];
};

// ---------------------------------------------------------------------------
// Groq client (lazy singleton)
// ---------------------------------------------------------------------------

let _groq: OpenAI | null = null;

/**
 * Returns the Groq OpenAI-compatible client, throwing a clear error when the
 * API key is absent.
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
// Core function
// ---------------------------------------------------------------------------

/**
 * Executes a single agent turn in a multi-agent conversation.
 *
 * Builds a system prompt by combining the agent's personality with mode-specific
 * instructions, converts the conversation history into an alternating
 * user/assistant message sequence, and calls the Groq API to generate the next
 * response.
 *
 * @param request - The full conversation context including both agent ids, mode,
 *   topic, and message history so far.
 * @param currentAgentId - The id of the agent whose turn it is to speak.
 * @param model - The LLM model id to use (defaults to llama-3.3-70b-versatile
 *   when the caller passes an empty string).
 * @returns A new AgentTurn containing the agent's response and its turn number.
 */
export async function runAgentTurn(
  request: MultiAgentRequest,
  currentAgentId: string,
  model: string
): Promise<AgentTurn> {
  const agent = AGENTS[currentAgentId];
  if (!agent) {
    throw new Error(`Unknown agent id: ${currentAgentId}`);
  }

  const otherAgentId =
    currentAgentId === request.agent1Id ? request.agent2Id : request.agent1Id;
  const otherAgent = AGENTS[otherAgentId];

  // Build the mode-specific instruction appended to the agent's base personality.
  const modeInstruction =
    request.mode === "debate"
      ? `You are in a DEBATE with ${otherAgent?.name ?? "another agent"} on the topic: "${request.topic}". ` +
        `Argue your perspective clearly and confidently. Challenge the other participant's points with counter-arguments, ` +
        `highlight weaknesses in their reasoning, and defend your own position. Keep responses focused and under 200 words.`
      : `You are COLLABORATING with ${otherAgent?.name ?? "another agent"} on the topic: "${request.topic}". ` +
        `Build constructively on the other participant's ideas. Acknowledge what they said, add new dimensions, ` +
        `and help move toward a richer shared understanding. Keep responses focused and under 200 words.`;

  const systemPrompt =
    `${agent.systemPrompt}\n\n${modeInstruction}\n\n` +
    `IMPORTANT: Never begin your response with your name or role in brackets (e.g. do NOT write "[${agent.name}]:" or any "[Label]:" prefix). Respond directly without any such prefix.`;

  // Map AgentTurn history to alternating user/assistant messages so the model
  // understands the conversation flow. Turns by the current agent are framed as
  // "assistant" messages; turns by the other agent are framed as "user" messages.
  // Note: content is passed as-is (no [Name]: prefix) so the model does not learn
  // to mirror that pattern in its own responses.
  const historyMessages: ChatCompletionMessageParam[] = request.history.map(
    (turn) => ({
      role: turn.agentId === currentAgentId ? "assistant" : "user",
      content: turn.content,
    })
  );

  // If there is no history yet this is the opening statement — seed the
  // conversation with a user message presenting the topic.
  const messages: ChatCompletionMessageParam[] =
    historyMessages.length === 0
      ? [{ role: "user", content: `The topic is: "${request.topic}". Please give your opening statement.` }]
      : historyMessages;

  const resolvedModel =
    model && model.trim() !== "" ? model : "llama-3.3-70b-versatile";

  const response = await getGroq().chat.completions.create({
    model: resolvedModel,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: 512,
  });

  // Strip any self-referencing prefix the model may prepend, e.g.
  // "[Code Expert]:", "[Agent Name]:", or "[Some Label]:" at the very start.
  const raw = response.choices[0]?.message?.content ?? "";
  const content = raw.replace(/^\s*\[[^\]]*\]\s*:\s*/, "");

  return {
    agentId: currentAgentId,
    agentName: agent.name,
    content,
    turnNumber: request.history.length + 1,
  };
}
