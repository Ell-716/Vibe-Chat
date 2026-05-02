import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { MCPTool } from "@shared/schema";
import { env } from "../config/env";
import { buildOpenAITools, handleToolCall } from "./mcp.service";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: 30_000,
});

const groq = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  timeout: 30_000,
});

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  timeout: 30_000,
});

const genAI = new GoogleGenerativeAI(env.GOOGLE_GEMINI_API_KEY || "");

export type AIModel = "gpt-4o-mini" | "groq-llama" | "claude-sonnet" | "gemini-flash";

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatParams {
  /** Full conversation history including the just-saved user message. */
  messages: ChatMessage[];
  /** The AI model to use for this request. */
  model: AIModel;
  /** The fully constructed system prompt (agent prompt + MCP context + RAG context). */
  systemPrompt: string;
  /** MCP tools to expose to GPT-4o-mini for tool-calling. Only used with gpt-4o-mini. */
  mcpTools?: MCPTool[];
}

/**
 * Assembles the system prompt by composing the agent persona, MCP tool context,
 * and any retrieved RAG document context.
 * @param agentPrompt - Custom system prompt from the selected agent, if any.
 * @param mcpTools - Active MCP tool configurations, used to describe available integrations.
 * @param ragContext - Pre-retrieved document context to inject, if any.
 * @returns The complete system prompt string to send to the model.
 */
export function buildSystemPrompt(
  agentPrompt?: string,
  mcpTools?: MCPTool[],
  ragContext?: string
): string {
  let prompt =
    agentPrompt ||
    "You are a helpful AI assistant called Vibe Chat. Be concise, clear, and helpful. When writing code, use markdown code blocks with the appropriate language identifier.";

  if (mcpTools && mcpTools.length > 0) {
    prompt += "\n\nYou have access to the following integrations:";
    if (mcpTools.some((t) => t.type === "drive")) {
      prompt +=
        "\n- Google Drive: You can search for files and retrieve file information. Use the tools provided when the user asks about their Drive files.";
    }
    if (mcpTools.some((t) => t.type === "sheets")) {
      prompt +=
        "\n- Google Sheets: You can read spreadsheets, add rows, and update data. Use the tools provided when the user asks about their spreadsheets.";
    }
    prompt +=
      "\n\nWhen the user asks about files or spreadsheets, USE THE TOOLS to actually look them up - don't just tell them how to find things themselves.";
  }

  if (ragContext) {
    prompt +=
      "\n\n--- DOCUMENT CONTEXT ---\nThe following information was retrieved from uploaded documents. Use it to answer the user's question accurately. If the context doesn't contain relevant information, say so.\n\n" +
      ragContext +
      "\n--- END DOCUMENT CONTEXT ---";
  }

  return prompt;
}

/**
 * Calls the selected AI model and yields response text as an async generator.
 * Each yielded string is a chunk of content the caller should forward to the client.
 *
 * Model-specific behaviour:
 * - gpt-4o-mini: Runs a tool-calling loop; yields MCP status messages and final text.
 * - groq-llama, claude-sonnet, gemini-flash: Single non-streaming call; yields full response at once.
 *
 * The generator pattern keeps this service free of any HTTP/SSE concerns —
 * the controller is responsible for formatting and writing SSE events.
 *
 * @param params - Chat parameters including messages, model, system prompt, and optional MCP tools.
 * @yields String chunks of the assistant's response.
 */
export async function* chat(params: ChatParams): AsyncGenerator<string> {
  const { messages, model, systemPrompt, mcpTools } = params;

  if (model === "groq-llama") {
    const chatMessages: ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemPrompt }, ...chatMessages],
      max_tokens: 2048,
    });

    yield response.choices[0]?.message?.content || "";
    return;
  }

  if (model === "claude-sonnet") {
    const claudeMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const textContent =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    yield textContent;
    return;
  }

  if (model === "gemini-flash") {
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Gemini requires history without the last message, which is sent separately
    const chatHistory = messages.slice(0, -1).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const geminiChat = geminiModel.startChat({
      history: chatHistory as any,
      systemInstruction: systemPrompt,
    });

    const lastMessage = messages[messages.length - 1];
    const result = await geminiChat.sendMessage(lastMessage?.content || "");
    yield result.response.text();
    return;
  }

  // Default: gpt-4o-mini with optional MCP tool-calling loop
  const chatMessages: ChatCompletionMessageParam[] = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const tools = buildOpenAITools(mcpTools);

  const allMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...chatMessages,
  ];

  let continueLoop = true;

  while (continueLoop) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: allMessages,
      tools,
      stream: false,
      max_completion_tokens: 2048,
    });

    const message = response.choices[0].message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      // Push the assistant's tool-call turn into the running context
      allMessages.push(message);

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") continue;

        const functionName = (toolCall as any).function.name;
        const functionArgs = JSON.parse((toolCall as any).function.arguments);

        // Yield a status message so the UI can show tool activity in real time
        yield `\n\n🔧 *Using ${functionName.replace(/_/g, " ")}...*\n\n`;

        const toolResult = await handleToolCall(functionName, functionArgs);

        allMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    } else {
      const textContent = message.content || "";
      if (textContent) {
        yield textContent;
      }
      continueLoop = false;
    }
  }
}
