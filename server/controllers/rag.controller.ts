import type { Request, Response } from "express";
import multer from "multer";
import {
  processDocument,
  getDocuments,
  deleteDocument,
  summarizeDocument,
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
    const doc = await processDocument(req.file.buffer, req.file.originalname, req.user!.id);
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
  res.json(getDocuments(req.user!.id));
}

/**
 * DELETE /api/documents/:id
 * Removes a document and all its embedded chunks from the in-memory RAG index.
 * Returns 404 if the document doesn't exist or doesn't belong to the current user.
 */
export function removeDocument(req: Request, res: Response): void {
  const deleted = deleteDocument(req.params.id, req.user!.id);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Document not found" });
  }
}

/**
 * POST /api/documents/:id/summarize
 * Generates a structured summary of an uploaded document using the selected LLM.
 * Uses a direct summarization for small documents (≤ 10 chunks) or a map-reduce
 * strategy for larger ones.
 * @param req.params.id - The document ID to summarize.
 * @param req.body.model - The AI model identifier to use; defaults to llama-3.3-70b-versatile.
 */
export async function summarizeDocumentHandler(req: Request, res: Response): Promise<void> {
  const documentId = req.params.id;
  const model = (req.body.model as string) || "llama-3.3-70b-versatile";
  const userId = req.user!.id;

  try {
    const summary = await summarizeDocument(documentId, userId, model);
    res.json({ summary, documentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("not found") || message.includes("access denied")) {
      res.status(404).json({ error: message });
      return;
    }
    if (message.includes("No content chunks")) {
      res.status(400).json({
        error: "Document has not been processed yet. Please wait a moment and try again.",
      });
      return;
    }
    console.error("Document summarization error:", error);
    res.status(500).json({ error: message });
  }
}

/**
 * GET /api/mcp/tools
 * Lists all tools available from the Zapier MCP endpoint.
 * Returns an empty tools array with configured: false when Zapier is not set up.
 */
export async function getMcpTools(_req: Request, res: Response): Promise<void> {
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
