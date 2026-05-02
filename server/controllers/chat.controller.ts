import type { Request, Response } from "express";
import { storage } from "../storage";
import { chat, buildSystemPrompt, type AIModel } from "../services/llm.service";
import { hasDocuments, retrieveContext } from "../services/rag.service";
import {
  cleanTextForSpeech,
  textToSpeechStream,
  getVoices,
  speechToText,
} from "../services/elevenlabs.service";
import { getDiscordBotStatus } from "../services/discord.service";
import { env } from "../config/env";
import type { MCPTool } from "@shared/schema";

// ─── Conversations ────────────────────────────────────────────────────────────

/**
 * GET /api/conversations
 * Returns all conversations sorted newest-first.
 */
export async function getConversations(req: Request, res: Response): Promise<void> {
  try {
    const conversations = await storage.getAllConversations();
    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
}

/**
 * GET /api/conversations/:id
 * Returns a single conversation with its full message history.
 */
export async function getConversation(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const conversation = await storage.getConversation(id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const messages = await storage.getMessagesByConversation(id);
    res.json({ ...conversation, messages });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
}

/**
 * POST /api/conversations
 * Creates a new conversation with the given title, defaulting to "New Chat".
 * @param req.body.title - Optional conversation title.
 */
export async function createConversation(req: Request, res: Response): Promise<void> {
  try {
    const { title } = req.body;
    const conversation = await storage.createConversation(title || "New Chat");
    res.status(201).json(conversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
}

/**
 * PATCH /api/conversations/:id
 * Renames a conversation.
 * @param req.body.title - The new title (required, non-empty string).
 */
export async function updateConversation(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const { title } = req.body;
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    const conversation = await storage.updateConversationTitle(id, title);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json(conversation);
  } catch (error) {
    console.error("Error updating conversation:", error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
}

/**
 * DELETE /api/conversations/:id
 * Deletes a conversation and all its messages (cascades in storage).
 */
export async function deleteConversation(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteConversation(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
}

// ─── Chat / Messaging ─────────────────────────────────────────────────────────

/**
 * POST /api/conversations/:id/messages
 * Saves the user message, calls the selected AI model, and streams the response
 * back to the client as Server-Sent Events (SSE).
 *
 * SSE event shape:
 *   data: { content: string }   — one or more content chunks during generation
 *   data: { done: true }        — signals end of stream
 *   data: { error: string }     — sent if an error occurs after headers are flushed
 *
 * @param req.body.content - The user's message text (required).
 * @param req.body.model - AI model ID. Defaults to "gpt-4o-mini".
 * @param req.body.agentId - Optional agent ID whose system prompt to use.
 * @param req.body.mcpTools - Optional array of MCPTool configs for tool-calling.
 */
export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const conversationId = parseInt(req.params.id);
    const { content, mcpTools, model = "gpt-4o-mini", agentId } = req.body;

    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "Content is required" });
      return;
    }

    // Persist user turn before streaming so it's available in history
    await storage.createMessage(conversationId, "user", content);
    const messages = await storage.getMessagesByConversation(conversationId);

    // Resolve agent persona if one is selected
    let agentPrompt: string | undefined;
    if (agentId) {
      const agent = await storage.getAgent(agentId);
      if (agent) agentPrompt = agent.systemPrompt;
    }

    // Retrieve relevant document context only when documents have been uploaded
    let ragContext = "";
    if (hasDocuments()) {
      ragContext = await retrieveContext(content);
    }

    const systemPrompt = buildSystemPrompt(
      agentPrompt,
      mcpTools as MCPTool[] | undefined,
      ragContext
    );

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    for await (const chunk of chat({
      messages,
      model: model as AIModel,
      systemPrompt,
      mcpTools: mcpTools as MCPTool[] | undefined,
    })) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    // Persist assistant turn after the full response has been streamed
    await storage.createMessage(conversationId, "assistant", fullResponse);

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Error sending message:", error);
    // Headers may already be flushed if the error occurred mid-stream
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Failed to send message" });
    }
  }
}

/**
 * GET /api/models
 * Returns the static list of supported AI models.
 */
export function getModels(req: Request, res: Response): void {
  res.json([
    { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
    { id: "groq-llama", name: "Llama 3", provider: "Groq" },
    { id: "claude-sonnet", name: "Claude Sonnet", provider: "Anthropic" },
    { id: "gemini-flash", name: "Gemini Flash", provider: "Google" },
  ]);
}

/**
 * GET /api/channels/status
 * Returns the connection status of each supported channel (Discord, web).
 */
export function getChannelStatus(req: Request, res: Response): void {
  const discordStatus = getDiscordBotStatus();
  res.json({
    discord: discordStatus,
    web: { connected: true },
  });
}

// ─── Voice (ElevenLabs) ──────────────────────────────────────────────────────��

/**
 * POST /api/text-to-speech
 * Converts AI response text to MPEG audio via ElevenLabs TTS and streams it back.
 * Markdown and tool-status annotations are stripped before synthesis.
 * @param req.body.text - The text to synthesise (required).
 * @param req.body.voiceId - ElevenLabs voice ID. Defaults to Rachel.
 */
export async function textToSpeech(req: Request, res: Response): Promise<void> {
  try {
    const { text, voiceId = "21m00Tcm4TlvDq8ikWAM" } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Text is required" });
      return;
    }

    if (!env.ELEVENLABS_API_KEY) {
      res.status(500).json({ error: "ElevenLabs API key not configured" });
      return;
    }

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) {
      res.status(400).json({ error: "No speakable text found" });
      return;
    }

    const audioStream = await textToSpeechStream(cleanText, voiceId);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Transfer-Encoding", "chunked");

    const reader = audioStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (error) {
    console.error("Error generating speech:", error);
    res.status(500).json({ error: "Failed to generate speech" });
  }
}

/**
 * GET /api/voices
 * Returns all available ElevenLabs voices for the configured account.
 */
export async function listVoices(req: Request, res: Response): Promise<void> {
  try {
    if (!env.ELEVENLABS_API_KEY) {
      res.status(500).json({ error: "ElevenLabs API key not configured" });
      return;
    }
    const voices = await getVoices();
    res.json(voices);
  } catch (error) {
    console.error("Error fetching voices:", error);
    res.status(500).json({ error: "Failed to fetch voices" });
  }
}

/**
 * POST /api/speech-to-text
 * Reads raw audio bytes from the request body and transcribes them via ElevenLabs Scribe.
 * The client sends audio/webm directly as the request body (not multipart).
 */
export async function speechToTextHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!env.ELEVENLABS_API_KEY) {
      res.status(500).json({ error: "ElevenLabs API key not configured" });
      return;
    }

    // Collect raw body chunks — the client sends audio/webm directly, not multipart
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const audioBuffer = Buffer.concat(chunks);

        if (audioBuffer.length === 0) {
          res.status(400).json({ error: "No audio data received" });
          return;
        }

        const text = await speechToText(audioBuffer);
        res.json({ text });
      } catch (error) {
        console.error("Error transcribing audio:", error);
        res.status(500).json({ error: "Failed to transcribe audio" });
      }
    });
  } catch (error) {
    console.error("Error in speech-to-text:", error);
    res.status(500).json({ error: "Failed to process audio" });
  }
}
