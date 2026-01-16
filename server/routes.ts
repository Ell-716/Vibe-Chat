import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import type { MCPTool } from "@shared/schema";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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

  const result = await response.json();
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
        mcpArgs = { Search_Query: args.query };
        break;
      case "google_drive_get_file":
        mcpToolName = "google_drive_retrieve_file_or_folder_by_id";
        mcpArgs = { File_ID: args.file_id };
        break;
      case "google_sheets_get_spreadsheet":
        mcpToolName = "google_sheets_get_spreadsheet_by_id";
        mcpArgs = { Spreadsheet: args.spreadsheet_id };
        break;
      case "google_sheets_create_row":
        mcpToolName = "google_sheets_create_spreadsheet_row";
        mcpArgs = { Spreadsheet: args.spreadsheet_id, ...args.values };
        break;
      case "google_sheets_update_row":
        mcpToolName = "google_sheets_update_spreadsheet_row_s_";
        mcpArgs = { Spreadsheet: args.spreadsheet_id, Row: args.row_number, ...args.values };
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

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, mcpTools } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Content is required" });
      }

      await storage.createMessage(conversationId, "user", content);

      const messages = await storage.getMessagesByConversation(conversationId);
      const chatMessages: ChatCompletionMessageParam[] = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const systemPrompt = buildSystemPrompt(mcpTools as MCPTool[] | undefined);
      const tools = buildOpenAITools(mcpTools as MCPTool[] | undefined);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const allMessages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...chatMessages,
      ];

      let fullResponse = "";
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

  return httpServer;
}
