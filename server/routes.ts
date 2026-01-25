import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { MCPTool } from "@shared/schema";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { getDiscordBotStatus } from "./discord-bot";
import { registerSupportRoutes } from "./support-routes";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

type AIModel = "gpt-4o-mini" | "groq-llama" | "claude-sonnet" | "gemini-flash";

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
        description: "Get a Google Sheets spreadsheet to read its data. Returns the cell data from the spreadsheet.",
        parameters: {
          type: "object",
          properties: {
            spreadsheet_name: {
              type: "string",
              description: "The name of the spreadsheet (e.g., 'Candidate_list', 'Jobs Posting Intake')",
            },
            what_data: {
              type: "string",
              description: "What data you want to see from the spreadsheet (e.g., 'all rows and columns', 'just the names and emails')",
            },
          },
          required: ["spreadsheet_name", "what_data"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "google_sheets_create_row",
        description: "Add a new row to a Google Sheets spreadsheet with the specified column values",
        parameters: {
          type: "object",
          properties: {
            spreadsheet_name: {
              type: "string",
              description: "The name of the spreadsheet (e.g., 'Candidate_list', 'Jobs Posting Intake')",
            },
            worksheet_name: {
              type: "string",
              description: "The name of the worksheet/tab within the spreadsheet (often the same as spreadsheet name, or 'Sheet1')",
            },
            row_data: {
              type: "string",
              description: "Description of the row data to add with column names and values (e.g., 'Name: John, Role: Developer, City: NYC')",
            },
          },
          required: ["spreadsheet_name", "row_data"],
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
            spreadsheet_name: {
              type: "string",
              description: "The name of the spreadsheet (e.g., 'Candidate_list', 'Jobs Posting Intake')",
            },
            row_identifier: {
              type: "string",
              description: "How to identify the row to update (e.g., 'row 5', 'the row where Name is John')",
            },
            updated_data: {
              type: "string",
              description: "The updated column values (e.g., 'Role: Senior Developer, City: LA')",
            },
          },
          required: ["spreadsheet_name", "row_identifier", "updated_data"],
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
          instructions: `Get the spreadsheet named "${args.spreadsheet_name}" and return its data`,
          spreadsheet: args.spreadsheet_name,
          includeGridData: "true",
          output_hint: args.what_data || "all data including all rows and columns"
        };
        break;
      case "google_sheets_create_row":
        mcpToolName = "google_sheets_create_spreadsheet_row";
        mcpArgs = { 
          instructions: `Add a new row to the "${args.spreadsheet_name}" spreadsheet${args.worksheet_name ? ` in worksheet "${args.worksheet_name}"` : ''}. The row data: ${args.row_data}`,
          spreadsheet: args.spreadsheet_name,
          worksheet: args.worksheet_name || args.spreadsheet_name,
          output_hint: "confirmation that the row was added successfully"
        };
        break;
      case "google_sheets_update_row":
        mcpToolName = "google_sheets_update_spreadsheet_row_s";
        mcpArgs = { 
          instructions: `Update ${args.row_identifier} in the "${args.spreadsheet_name}" spreadsheet with: ${args.updated_data}`,
          spreadsheet: args.spreadsheet_name,
          output_hint: "confirmation that the row was updated successfully"
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

function buildSystemPrompt(agentPrompt?: string, mcpTools?: MCPTool[]): string {
  let prompt = agentPrompt || "You are a helpful AI assistant called Vibe Chat. Be concise, clear, and helpful. When writing code, use markdown code blocks with the appropriate language identifier.";
  
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
      { id: "groq-llama", name: "Llama 3", provider: "Groq" },
      { id: "claude-sonnet", name: "Claude Sonnet", provider: "Anthropic" },
      { id: "gemini-flash", name: "Gemini Flash", provider: "Google" },
    ];
    res.json(models);
  });

  // Agent management endpoints
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAllAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ error: "Failed to fetch agent" });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const { name, description, systemPrompt, icon } = req.body;
      if (!name || !systemPrompt) {
        return res.status(400).json({ error: "Name and system prompt are required" });
      }
      const agent = await storage.createAgent({
        name,
        description: description || "",
        systemPrompt,
        icon: icon || "bot",
      });
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.patch("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.updateAgent(req.params.id, req.body);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", async (req, res) => {
    try {
      await storage.deleteAgent(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, mcpTools, model = "gpt-4o-mini", agentId } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Content is required" });
      }

      await storage.createMessage(conversationId, "user", content);

      const messages = await storage.getMessagesByConversation(conversationId);
      
      // Get agent's system prompt if specified
      let agentPrompt: string | undefined;
      if (agentId) {
        const agent = await storage.getAgent(agentId);
        if (agent) {
          agentPrompt = agent.systemPrompt;
        }
      }
      
      const systemPrompt = buildSystemPrompt(agentPrompt, mcpTools as MCPTool[] | undefined);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullResponse = "";

      if (model === "groq-llama") {
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
      } else if (model === "claude-sonnet") {
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

        const textContent = response.content[0]?.type === "text" ? response.content[0].text : "";
        fullResponse = textContent;
        res.write(`data: ${JSON.stringify({ content: textContent })}\n\n`);
      } else if (model === "gemini-flash") {
        const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const chatHistory = messages.slice(0, -1).map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        }));

        const chat = geminiModel.startChat({
          history: chatHistory as any,
          systemInstruction: systemPrompt,
        });

        const lastMessage = messages[messages.length - 1];
        const result = await chat.sendMessage(lastMessage?.content || "");
        const textContent = result.response.text();
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

  app.post("/api/speech-to-text", async (req, res) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const audioBuffer = Buffer.concat(chunks);
          
          if (audioBuffer.length === 0) {
            return res.status(400).json({ error: "No audio data received" });
          }

          const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });

          const transcription = await elevenlabs.speechToText.convert({
            file: audioBlob,
            modelId: "scribe_v1",
          });

          const result = transcription as { text?: string };
          res.json({ text: result.text || "" });
        } catch (error) {
          console.error("Error transcribing audio:", error);
          res.status(500).json({ error: "Failed to transcribe audio" });
        }
      });
    } catch (error) {
      console.error("Error in speech-to-text:", error);
      res.status(500).json({ error: "Failed to process audio" });
    }
  });

  app.get("/api/channels/status", (req, res) => {
    const discordStatus = getDiscordBotStatus();
    res.json({
      discord: discordStatus,
      web: { connected: true },
    });
  });

  registerSupportRoutes(app);

  return httpServer;
}
