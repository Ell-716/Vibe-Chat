import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { MCPTool } from "@shared/schema";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

type AIModel = "gpt-4o-mini" | "claude-sonnet" | "groq-llama";

const ZAPIER_MCP_URL = process.env.ZAPIER_MCP_URL;
const ZAPIER_MCP_API_KEY = process.env.ZAPIER_MCP_API_KEY;

let mcpRequestId = 1;

async function callMCP(method: string, params: Record<string, any> = {}): Promise<any> {
  if (!ZAPIER_MCP_URL || !ZAPIER_MCP_API_KEY) {
    throw new Error("Zapier MCP credentials not configured");
  }

  const requestBody = {
    jsonrpc: "2.0",
    id: mcpRequestId++,
    method,
    params,
  };

  console.log("MCP Request:", JSON.stringify(requestBody, null, 2));

  const response = await fetch(ZAPIER_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Authorization": `Bearer ${ZAPIER_MCP_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("MCP Error Response:", error);
    throw new Error(`MCP error: ${response.status} ${error}`);
  }

  const contentType = response.headers.get("content-type") || "";
  let result: any;

  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    console.log("MCP SSE Response:", text);
    
    const lines = text.split('\n');
    let jsonData = '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        jsonData += line.slice(6);
      }
    }
    
    if (jsonData) {
      try {
        result = JSON.parse(jsonData);
      } catch (e) {
        console.log("Failed to parse SSE data as JSON, trying line by line");
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              result = JSON.parse(line.slice(6));
              break;
            } catch (e2) {
              continue;
            }
          }
        }
      }
    }
    
    if (!result) {
      throw new Error(`Failed to parse MCP SSE response: ${text.substring(0, 200)}`);
    }
  } else {
    result = await response.json();
  }
  
  console.log("MCP Response:", JSON.stringify(result, null, 2));
  
  if (result.error) {
    throw new Error(`MCP error: ${result.error.message || JSON.stringify(result.error)}`);
  }
  
  return result.result;
}

async function listMCPTools(): Promise<any[]> {
  try {
    if (!ZAPIER_MCP_URL) {
      return [];
    }
    const result = await callMCP("tools/list");
    return result?.tools || [];
  } catch (error) {
    console.error("Error listing MCP tools:", error);
    return [];
  }
}

async function executeMCPTool(toolName: string, args: Record<string, any>): Promise<any> {
  try {
    const result = await callMCP("tools/call", {
      name: toolName,
      arguments: args,
    });
    return result;
  } catch (error) {
    console.error("Error executing MCP tool:", error);
    throw error;
  }
}

function buildOpenAITools(mcpTools?: MCPTool[]): ChatCompletionTool[] | undefined {
  if (!mcpTools || mcpTools.length === 0) return undefined;

  const tools: ChatCompletionTool[] = [];

  if (mcpTools.some(t => t.type === 'drive')) {
    tools.push({
      type: "function",
      function: {
        name: "google_drive_find_file",
        description: "Search for files in Google Drive by name or query",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query to find files (file name or search terms)",
            },
          },
          required: ["query"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "google_drive_get_file",
        description: "Get a specific file from Google Drive by its ID",
        parameters: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "The Google Drive file ID",
            },
          },
          required: ["file_id"],
        },
      },
    });
  }

  if (mcpTools.some(t => t.type === 'sheets')) {
    tools.push({
      type: "function",
      function: {
        name: "google_sheets_get_spreadsheet",
        description: "Get a Google Sheets spreadsheet by its ID to read its data",
        parameters: {
          type: "object",
          properties: {
            spreadsheet_id: {
              type: "string",
              description: "The Google Sheets spreadsheet ID",
            },
          },
          required: ["spreadsheet_id"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "google_sheets_create_row",
        description: "Add a new row to a Google Sheets spreadsheet",
        parameters: {
          type: "object",
          properties: {
            spreadsheet_id: {
              type: "string",
              description: "The Google Sheets spreadsheet ID",
            },
            values: {
              type: "object",
              description: "Key-value pairs of column names to values for the new row",
            },
          },
          required: ["spreadsheet_id", "values"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "google_sheets_update_row",
        description: "Update an existing row in a Google Sheets spreadsheet",
        parameters: {
          type: "object",
          properties: {
            spreadsheet_id: {
              type: "string",
              description: "The Google Sheets spreadsheet ID",
            },
            row_number: {
              type: "number",
              description: "The row number to update",
            },
            values: {
              type: "object",
              description: "Key-value pairs of column names to updated values",
            },
          },
          required: ["spreadsheet_id", "row_number", "values"],
        },
      },
    });
  }

  return tools.length > 0 ? tools : undefined;
}

async function handleToolCall(functionName: string, args: Record<string, any>): Promise<string> {
  console.log(`Handling tool call: ${functionName}`, args);
  
  try {
    let mcpToolName: string;
    let mcpArgs: Record<string, any>;

    switch (functionName) {
      case "google_drive_find_file":
        mcpToolName = "google_drive_find_a_file";
        mcpArgs = { 
          instructions: `Search for files matching: ${args.query || 'all files'}`,
          Search_Query: args.query || ""
        };
        break;
      case "google_drive_get_file":
        mcpToolName = "google_drive_retrieve_file_or_folder_by_id";
        mcpArgs = { 
          instructions: `Retrieve file with ID: ${args.file_id}`,
          File_ID: args.file_id 
        };
        break;
      case "google_sheets_get_spreadsheet":
        mcpToolName = "google_sheets_get_spreadsheet_by_id";
        mcpArgs = { 
          instructions: `Get spreadsheet with ID: ${args.spreadsheet_id}`,
          Spreadsheet: args.spreadsheet_id 
        };
        break;
      case "google_sheets_create_row":
        mcpToolName = "google_sheets_create_spreadsheet_row";
        mcpArgs = { 
          instructions: `Add a new row to spreadsheet ${args.spreadsheet_id}`,
          Spreadsheet: args.spreadsheet_id, 
          ...args.values 
        };
        break;
      case "google_sheets_update_row":
        mcpToolName = "google_sheets_update_spreadsheet_row_s_";
        mcpArgs = { 
          instructions: `Update row ${args.row_number} in spreadsheet ${args.spreadsheet_id}`,
          Spreadsheet: args.spreadsheet_id, 
          Row: args.row_number, 
          ...args.values 
        };
        break;
      default:
        return JSON.stringify({ error: `Unknown function: ${functionName}` });
    }

    const result = await executeMCPTool(mcpToolName, mcpArgs);
    return JSON.stringify(result, null, 2);
  } catch (error) {
    console.error(`Tool call error for ${functionName}:`, error);
    return JSON.stringify({ error: error instanceof Error ? error.message : "Tool execution failed" });
  }
}

function buildSystemPrompt(mcpTools?: MCPTool[]): string {
  let prompt = "You are a helpful AI assistant called Vibe Chat. Be concise, clear, and helpful. When writing code, use markdown code blocks with the appropriate language identifier.";
  
  if (mcpTools && mcpTools.length > 0) {
    prompt += "\n\nYou have access to the following integrations:";
    if (mcpTools.some(t => t.type === 'drive')) {
      prompt += "\n- Google Drive: You can search for files and retrieve file information. Use the tools provided when the user asks about their Drive files.";
    }
    if (mcpTools.some(t => t.type === 'sheets')) {
      prompt += "\n- Google Sheets: You can read spreadsheets, add rows, and update data. Use the tools provided when the user asks about their spreadsheets.";
    }
    prompt += "\n\nWhen the user asks about files or spreadsheets, USE THE TOOLS to actually look them up - don't just tell them how to find things themselves.";
  }
  
  return prompt;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const { title } = req.body;
      const conversation = await storage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.patch("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title } = req.body;
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required" });
      }
      const conversation = await storage.updateConversationTitle(id, title);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      console.error("Error updating conversation:", error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.get("/api/mcp/tools", async (req, res) => {
    try {
      const tools = await listMCPTools();
      res.json({ tools, configured: !!ZAPIER_MCP_URL });
    } catch (error) {
      console.error("Error fetching MCP tools:", error);
      res.json({ tools: [], configured: false, error: String(error) });
    }
  });

  app.post("/api/mcp/execute", async (req, res) => {
    try {
      const { toolName, args } = req.body;
      if (!toolName) {
        return res.status(400).json({ error: "Tool name is required" });
      }
      const result = await executeMCPTool(toolName, args || {});
      res.json(result);
    } catch (error) {
      console.error("Error executing MCP tool:", error);
      res.status(500).json({ error: "Failed to execute MCP tool" });
    }
  });

  app.get("/api/models", (req, res) => {
    const models = [
      { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
      { id: "claude-sonnet", name: "Claude Sonnet", provider: "Anthropic" },
      { id: "groq-llama", name: "Llama 3 (Groq)", provider: "Groq" },
    ];
    res.json(models);
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, mcpTools, model = "gpt-4o-mini" } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Content is required" });
      }

      await storage.createMessage(conversationId, "user", content);

      const messages = await storage.getMessagesByConversation(conversationId);
      const systemPrompt = buildSystemPrompt(mcpTools as MCPTool[] | undefined);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullResponse = "";

      if (model === "claude-sonnet") {
        const anthropicMessages = messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: systemPrompt,
          messages: anthropicMessages,
        });

        const textContent = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("");

        fullResponse = textContent;
        res.write(`data: ${JSON.stringify({ content: textContent })}\n\n`);
      } else if (model === "groq-llama") {
        const chatMessages: ChatCompletionMessageParam[] = messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const allMessages: ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...chatMessages,
        ];

        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: allMessages,
          max_tokens: 2048,
        });

        const textContent = response.choices[0]?.message?.content || "";
        fullResponse = textContent;
        res.write(`data: ${JSON.stringify({ content: textContent })}\n\n`);
      } else {
        const chatMessages: ChatCompletionMessageParam[] = messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const tools = buildOpenAITools(mcpTools as MCPTool[] | undefined);

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

          const choice = response.choices[0];
          const message = choice.message;

          if (message.tool_calls && message.tool_calls.length > 0) {
            allMessages.push(message);

            for (const toolCall of message.tool_calls) {
              if (toolCall.type !== 'function') continue;
              const functionName = (toolCall as any).function.name;
              const functionArgs = JSON.parse((toolCall as any).function.arguments);
              
              res.write(`data: ${JSON.stringify({ content: `\n\n🔧 *Using ${functionName.replace(/_/g, ' ')}...*\n\n` })}\n\n`);
              fullResponse += `\n\n🔧 *Using ${functionName.replace(/_/g, ' ')}...*\n\n`;

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
              fullResponse += textContent;
              res.write(`data: ${JSON.stringify({ content: textContent })}\n\n`);
            }
            continueLoop = false;
          }
        }
      }

      await storage.createMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });

  app.post("/api/text-to-speech", async (req, res) => {
    try {
      const { text, voiceId = "21m00Tcm4TlvDq8ikWAM" } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      if (!process.env.ELEVENLABS_API_KEY) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      const cleanText = text
        .replace(/```[\s\S]*?```/g, "")
        .replace(/🔧.*?\.\.\.\*\n\n/g, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/#+\s/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim();

      if (!cleanText) {
        return res.status(400).json({ error: "No speakable text found" });
      }

      const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
        text: cleanText.substring(0, 5000),
        modelId: "eleven_multilingual_v2",
      });

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
  });

  app.get("/api/voices", async (req, res) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      const voices = await elevenlabs.voices.getAll();
      res.json(voices);
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({ error: "Failed to fetch voices" });
    }
  });

  return httpServer;
}
