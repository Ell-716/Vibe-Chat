import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSystemPrompt } from "../services/llm.service";
import type { AIModel } from "../services/llm.service";

// mapLLMError is private (not exported). It is tested indirectly by driving
// chat() with mocked provider clients that throw errors with specific status
// codes, then asserting that the re-thrown error carries the expected
// user-friendly message rather than the raw SDK internals.

const BASE_MESSAGES = [{ role: "user" as const, content: "hello" }];
const GROQ_MODEL: AIModel = "openai/gpt-oss-120b";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Drains an async generator to completion, collecting all yielded chunks.
 * Used to trigger the catch block inside chat() so mapLLMError fires.
 * @param gen - The async generator to drain.
 * @returns All yielded string chunks.
 */
async function drain(gen: AsyncGenerator<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of gen) chunks.push(chunk);
  return chunks;
}

/**
 * Registers mocked versions of openai, env, and mcp.service, then dynamically
 * imports a fresh copy of llm.service so the lazy singletons are re-created
 * with the new mocks (avoids stale cached client instances across tests).
 * @param mockCreate - vi.fn() to substitute for completions.create.
 * @returns The chat() function from the freshly imported module.
 */
async function getChatFn(mockCreate: ReturnType<typeof vi.fn>) {
  // Use a regular function (not an arrow function) for the constructor mock.
  // Arrow functions cannot be used with `new`, so vitest warns and the returned
  // object is not the one the SDK client stores — causing status codes to be lost.
  vi.doMock("openai", () => ({
    default: function MockOpenAI() {
      return { chat: { completions: { create: mockCreate } } };
    },
  }));
  vi.doMock("../config/env", () => ({
    env: {
      GROQ_API_KEY: "test-groq-key",
      OPENAI_API_KEY: "test-openai-key",
      ANTHROPIC_API_KEY: "test-anthropic-key",
      GOOGLE_GEMINI_API_KEY: "test-gemini-key",
      DEEPSEEK_API_KEY: "test-deepseek-key",
    },
  }));
  vi.doMock("../services/mcp.service", () => ({
    buildOpenAITools: vi.fn().mockReturnValue([]),
    handleToolCall: vi.fn().mockResolvedValue(""),
  }));
  const { chat } = await import("../services/llm.service");
  return chat;
}

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

describe("buildSystemPrompt", () => {
  it("returns a string", () => {
    expect(typeof buildSystemPrompt()).toBe("string");
  });

  it("includes the agent system prompt when provided", () => {
    const result = buildSystemPrompt("You are a pirate assistant.");
    expect(result).toContain("You are a pirate assistant.");
  });

  it("includes document context when ragContext is provided", () => {
    const result = buildSystemPrompt(undefined, undefined, "Quarterly revenue was $4M.");
    expect(result).toContain("Quarterly revenue was $4M.");
    expect(result).toContain("DOCUMENT CONTEXT");
  });

  it("excludes document context section when ragContext is not provided", () => {
    const result = buildSystemPrompt("My agent prompt");
    expect(result).not.toContain("DOCUMENT CONTEXT");
    expect(result).not.toContain("END DOCUMENT CONTEXT");
  });
});

// ─── mapLLMError (via chat()) ─────────────────────────────────────────────────

describe("mapLLMError (tested indirectly via chat())", () => {
  // Reset module registry before each test so vi.doMock registers a fresh mock
  // and the lazy singletons inside llm.service are re-created from scratch.
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps 401/unauthorized errors to an 'invalid key' message", async () => {
    const mockCreate = vi.fn().mockRejectedValue(
      Object.assign(new Error("invalid_api_key"), { status: 401 })
    );
    const chat = await getChatFn(mockCreate);

    await expect(
      drain(chat({ messages: BASE_MESSAGES, model: GROQ_MODEL, systemPrompt: "test" }))
    ).rejects.toThrow(/invalid.*key|missing/i);
  });

  it("maps 429/rate limit errors to a 'rate limit exceeded' message", async () => {
    const mockCreate = vi.fn().mockRejectedValue(
      Object.assign(new Error("rate_limit_exceeded"), { status: 429 })
    );
    const chat = await getChatFn(mockCreate);

    await expect(
      drain(chat({ messages: BASE_MESSAGES, model: GROQ_MODEL, systemPrompt: "test" }))
    ).rejects.toThrow(/rate limit/i);
  });

  it("maps 402/payment errors to an 'insufficient balance' message", async () => {
    const mockCreate = vi.fn().mockRejectedValue(
      Object.assign(new Error("insufficient_balance"), { status: 402 })
    );
    const chat = await getChatFn(mockCreate);

    await expect(
      drain(chat({ messages: BASE_MESSAGES, model: GROQ_MODEL, systemPrompt: "test" }))
    ).rejects.toThrow(/balance/i);
  });

  it("maps 503/service unavailable errors to a 'temporarily unavailable' message", async () => {
    const mockCreate = vi.fn().mockRejectedValue(
      Object.assign(new Error("service_unavailable"), { status: 503 })
    );
    const chat = await getChatFn(mockCreate);

    await expect(
      drain(chat({ messages: BASE_MESSAGES, model: GROQ_MODEL, systemPrompt: "test" }))
    ).rejects.toThrow(/temporarily unavailable/i);
  });

  it("returns a generic fallback message for unknown errors", async () => {
    const mockCreate = vi.fn().mockRejectedValue(
      new Error("something completely unexpected happened")
    );
    const chat = await getChatFn(mockCreate);

    await expect(
      drain(chat({ messages: BASE_MESSAGES, model: GROQ_MODEL, systemPrompt: "test" }))
    ).rejects.toThrow(/failed to get response/i);
  });

  it("never exposes raw SDK error internals in the returned message", async () => {
    // Simulates an SDK error that leaks sensitive internal details such as a
    // partial API key or internal endpoint URL — mapLLMError must sanitise these.
    const rawInternal = "sk-proj-secret-key-abcdef123 caused an authentication failure at https://api.groq.com";
    const mockCreate = vi.fn().mockRejectedValue(
      Object.assign(new Error(rawInternal), { status: 401 })
    );
    const chat = await getChatFn(mockCreate);

    await expect(
      drain(chat({ messages: BASE_MESSAGES, model: GROQ_MODEL, systemPrompt: "test" }))
    ).rejects.toSatisfy(
      (err: unknown) => !(err as Error).message.includes("sk-proj-secret-key-abcdef123")
    );
  });
});
