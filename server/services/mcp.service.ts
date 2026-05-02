import type { MCPTool } from "@shared/schema";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { env } from "../config/env";

/** Monotonically increasing JSON-RPC request ID. */
let mcpRequestId = 1;

/**
 * Sends a JSON-RPC request to the Zapier MCP endpoint.
 * Handles both standard JSON responses and Server-Sent Events (SSE) responses,
 * which Zapier uses for some tool calls.
 * Throws when MCP credentials are not configured.
 * @param method - The JSON-RPC method name (e.g. "tools/list", "tools/call").
 * @param params - Optional method parameters.
 * @returns The parsed JSON-RPC result value.
 */
async function callMCP(method: string, params: Record<string, any> = {}): Promise<any> {
  if (!env.ZAPIER_MCP_URL || !env.ZAPIER_MCP_API_KEY) {
    throw new Error("Zapier MCP credentials not configured");
  }

  const requestBody = {
    jsonrpc: "2.0",
    id: mcpRequestId++,
    method,
    params,
  };

  console.log("MCP Request:", JSON.stringify(requestBody, null, 2));

  const response = await fetch(env.ZAPIER_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${env.ZAPIER_MCP_API_KEY}`,
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

    const lines = text.split("\n");
    let jsonData = "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        jsonData += line.slice(6);
      }
    }

    if (jsonData) {
      try {
        result = JSON.parse(jsonData);
      } catch {
        // Fallback: try parsing each SSE data line individually
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              result = JSON.parse(line.slice(6));
              break;
            } catch {
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

/**
 * Fetches the list of available tools from the Zapier MCP endpoint.
 * Returns an empty array (without throwing) when MCP is not configured.
 * @returns Array of raw MCP tool descriptor objects.
 */
export async function listMCPTools(): Promise<any[]> {
  try {
    if (!env.ZAPIER_MCP_URL) return [];
    const result = await callMCP("tools/list");
    return result?.tools || [];
  } catch (error) {
    console.error("Error listing MCP tools:", error);
    return [];
  }
}

/**
 * Executes a named tool on the Zapier MCP endpoint with the provided arguments.
 * @param toolName - The MCP tool name to invoke.
 * @param args - Key-value arguments to pass to the tool.
 * @returns The tool's result payload.
 */
export async function executeMCPTool(toolName: string, args: Record<string, any>): Promise<any> {
  try {
    return await callMCP("tools/call", { name: toolName, arguments: args });
  } catch (error) {
    console.error("Error executing MCP tool:", error);
    throw error;
  }
}

/**
 * Converts the active MCPTool configuration into OpenAI function-calling tool definitions.
 * Returns undefined when no tools are provided so OpenAI omits the tools field entirely.
 * @param mcpTools - Array of MCPTool configs selected by the user for this conversation.
 * @returns Array of ChatCompletionTool definitions, or undefined if no tools are active.
 */
export function buildOpenAITools(mcpTools?: MCPTool[]): ChatCompletionTool[] | undefined {
  if (!mcpTools || mcpTools.length === 0) return undefined;

  const tools: ChatCompletionTool[] = [];

  if (mcpTools.some((t) => t.type === "drive")) {
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

  if (mcpTools.some((t) => t.type === "sheets")) {
    tools.push({
      type: "function",
      function: {
        name: "google_sheets_get_spreadsheet",
        description:
          "Get a Google Sheets spreadsheet to read its data. Returns the cell data from the spreadsheet.",
        parameters: {
          type: "object",
          properties: {
            spreadsheet_name: {
              type: "string",
              description:
                "The name of the spreadsheet (e.g., 'Candidate_list', 'Jobs Posting Intake')",
            },
            what_data: {
              type: "string",
              description:
                "What data you want to see from the spreadsheet (e.g., 'all rows and columns', 'just the names and emails')",
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
        description:
          "Add a new row to a Google Sheets spreadsheet with the specified column values",
        parameters: {
          type: "object",
          properties: {
            spreadsheet_name: {
              type: "string",
              description:
                "The name of the spreadsheet (e.g., 'Candidate_list', 'Jobs Posting Intake')",
            },
            worksheet_name: {
              type: "string",
              description:
                "The name of the worksheet/tab within the spreadsheet (often the same as spreadsheet name, or 'Sheet1')",
            },
            row_data: {
              type: "string",
              description:
                "Description of the row data to add with column names and values (e.g., 'Name: John, Role: Developer, City: NYC')",
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
              description:
                "The name of the spreadsheet (e.g., 'Candidate_list', 'Jobs Posting Intake')",
            },
            row_identifier: {
              type: "string",
              description:
                "How to identify the row to update (e.g., 'row 5', 'the row where Name is John')",
            },
            updated_data: {
              type: "string",
              description:
                "The updated column values (e.g., 'Role: Senior Developer, City: LA')",
            },
          },
          required: ["spreadsheet_name", "row_identifier", "updated_data"],
        },
      },
    });
  }

  return tools.length > 0 ? tools : undefined;
}

/**
 * Translates an OpenAI function-call name into the corresponding Zapier MCP tool call
 * and returns the serialised result.
 * Returns a JSON error string (rather than throwing) so the model can report the failure gracefully.
 * @param functionName - The OpenAI function name as declared in buildOpenAITools.
 * @param args - Parsed arguments from the model's function call.
 * @returns JSON-serialised tool result or error object.
 */
export async function handleToolCall(
  functionName: string,
  args: Record<string, any>
): Promise<string> {
  console.log(`Handling tool call: ${functionName}`, args);

  try {
    let mcpToolName: string;
    let mcpArgs: Record<string, any>;

    switch (functionName) {
      case "google_drive_find_file":
        mcpToolName = "google_drive_find_a_file";
        mcpArgs = {
          instructions: `Search for files matching: ${args.query || "all files"}`,
          Search_Query: args.query || "",
        };
        break;

      case "google_drive_get_file":
        mcpToolName = "google_drive_retrieve_file_or_folder_by_id";
        mcpArgs = {
          instructions: `Retrieve file with ID: ${args.file_id}`,
          File_ID: args.file_id,
        };
        break;

      case "google_sheets_get_spreadsheet":
        mcpToolName = "google_sheets_get_spreadsheet_by_id";
        mcpArgs = {
          instructions: `Get the spreadsheet named "${args.spreadsheet_name}" and return its data`,
          spreadsheet: args.spreadsheet_name,
          includeGridData: "true",
          output_hint: args.what_data || "all data including all rows and columns",
        };
        break;

      case "google_sheets_create_row":
        mcpToolName = "google_sheets_create_spreadsheet_row";
        mcpArgs = {
          instructions: `Add a new row to the "${args.spreadsheet_name}" spreadsheet${
            args.worksheet_name ? ` in worksheet "${args.worksheet_name}"` : ""
          }. The row data: ${args.row_data}`,
          spreadsheet: args.spreadsheet_name,
          worksheet: args.worksheet_name || args.spreadsheet_name,
          output_hint: "confirmation that the row was added successfully",
        };
        break;

      case "google_sheets_update_row":
        mcpToolName = "google_sheets_update_spreadsheet_row_s";
        mcpArgs = {
          instructions: `Update ${args.row_identifier} in the "${args.spreadsheet_name}" spreadsheet with: ${args.updated_data}`,
          spreadsheet: args.spreadsheet_name,
          output_hint: "confirmation that the row was updated successfully",
        };
        break;

      default:
        return JSON.stringify({ error: `Unknown function: ${functionName}` });
    }

    const result = await executeMCPTool(mcpToolName, mcpArgs);
    return JSON.stringify(result, null, 2);
  } catch (error) {
    console.error(`Tool call error for ${functionName}:`, error);
    return JSON.stringify({
      error: error instanceof Error ? error.message : "Tool execution failed",
    });
  }
}
