import type { Request, Response } from "express";
import multer from "multer";
import {
  processDocument,
  getDocuments,
  deleteDocument,
} from "../services/rag.service";
import { listMCPTools, executeMCPTool } from "../services/mcp.service";
import { env } from "../config/env";

/**
 * Multer instance configured for in-memory PDF uploads.
 * Exported so routes.ts can apply it as per-route middleware.
 * Max file size: 50 MB.
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

/**
 * POST /api/documents/upload
 * Accepts a single PDF file, extracts and embeds its text, and stores it in the RAG index.
 * Expects the file under the "file" multipart field (applied via uploadMiddleware.single).
 */
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    if (req.file.mimetype !== "application/pdf") {
      res.status(400).json({ error: "Only PDF files are supported" });
      return;
    }
    // Validate by extension as well — mimetype alone can be spoofed by the client
    const ext = req.file.originalname.split(".").pop()?.toLowerCase();
    if (ext !== "pdf") {
      res.status(400).json({ error: "Only PDF files are supported" });
      return;
    }
    const doc = await processDocument(req.file.buffer, req.file.originalname);
    res.json(doc);
  } catch (error) {
    console.error("Document upload error:", error);
    res.status(500).json({ error: "Failed to process document" });
  }
}

/**
 * GET /api/documents
 * Returns metadata for all documents currently loaded in the RAG index.
 */
export function listDocuments(req: Request, res: Response): void {
  res.json(getDocuments());
}

/**
 * DELETE /api/documents/:id
 * Removes a document and all its embedded chunks from the in-memory RAG index.
 */
export function removeDocument(req: Request, res: Response): void {
  const deleted = deleteDocument(req.params.id);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Document not found" });
  }
}

/**
 * GET /api/mcp/tools
 * Lists all tools available from the Zapier MCP endpoint.
 * Returns an empty tools array with configured: false when Zapier is not set up.
 */
export async function getMcpTools(req: Request, res: Response): Promise<void> {
  try {
    const tools = await listMCPTools();
    res.json({ tools, configured: !!env.ZAPIER_MCP_URL });
  } catch (error) {
    console.error("Error fetching MCP tools:", error);
    res.json({ tools: [], configured: false, error: String(error) });
  }
}

/**
 * POST /api/mcp/execute
 * Executes a named Zapier MCP tool with the provided arguments.
 * @param req.body.toolName - The MCP tool name to invoke (required).
 * @param req.body.args - Optional key-value arguments to pass to the tool.
 */
export async function executeMcp(req: Request, res: Response): Promise<void> {
  try {
    const { toolName, args } = req.body;
    if (!toolName) {
      res.status(400).json({ error: "Tool name is required" });
      return;
    }
    const result = await executeMCPTool(toolName, args || {});
    res.json(result);
  } catch (error) {
    console.error("Error executing MCP tool:", error);
    res.status(500).json({ error: "Failed to execute MCP tool" });
  }
}
