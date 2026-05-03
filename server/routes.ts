import type { Express } from "express";
import type { Server } from "http";
import * as chatController from "./controllers/chat.controller";
import * as agentController from "./controllers/agent.controller";
import * as ragController from "./controllers/rag.controller";
import * as supportController from "./controllers/support.controller";

/**
 * Registers all application routes on the Express app.
 * This file contains only route declarations — all request handling
 * and business logic lives in controllers/ and services/.
 * @param httpServer - The underlying HTTP server (returned unchanged).
 * @param app - The Express application instance.
 * @returns The HTTP server, for chaining in index.ts.
 */
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ── Conversations ──────────────────────────────────────────────────────────
  app.get("/api/conversations", chatController.getConversations);
  app.get("/api/conversations/:id", chatController.getConversation);
  app.post("/api/conversations", chatController.createConversation);
  app.patch("/api/conversations/:id", chatController.updateConversation);
  app.delete("/api/conversations/:id", chatController.deleteConversation);

  // ── Chat / messaging ───────────────────────────────────────────────────────
  app.post("/api/conversations/:id/messages", chatController.sendMessage);

  // ── Models & channels ──────────────────────────────────────────────────────
  app.get("/api/models", chatController.getModels);
  app.get("/api/channels/status", chatController.getChannelStatus);

  // ── Voice (ElevenLabs) ────────────────────────────────────────────────────
  app.post("/api/text-to-speech", chatController.textToSpeech);
  app.get("/api/voices", chatController.listVoices);
  app.post("/api/speech-to-text", chatController.speechToTextHandler);

  // ── AI agents ─────────────────────────────────────────────────────────────
  app.get("/api/agents", agentController.getAgents);
  app.get("/api/agents/:id", agentController.getAgent);
  app.post("/api/agents", agentController.createAgent);
  app.patch("/api/agents/:id", agentController.updateAgent);
  app.delete("/api/agents/:id", agentController.deleteAgent);

  // ── RAG documents ─────────────────────────────────────────────────────────
  app.post(
    "/api/documents/upload",
    ragController.uploadMiddleware.single("file"),
    ragController.uploadDocument
  );
  app.get("/api/documents", ragController.listDocuments);
  app.delete("/api/documents/:id", ragController.removeDocument);

  // ── MCP (Zapier) ──────────────────────────────────────────────────────────
  app.get("/api/mcp/tools", ragController.getMcpTools);
  app.post("/api/mcp/execute", ragController.executeMcp);

  // ── Support tickets ───────────────────────────────────────────────────────
  app.get("/api/support/tickets", supportController.getTickets);
  app.get("/api/support/tickets/:id", supportController.getTicket);
  app.post("/api/support/tickets", supportController.createTicket);
  app.patch("/api/support/tickets/:id", supportController.updateTicket);
  app.delete("/api/support/tickets/:id", supportController.deleteTicket);

  // ── Ticket messages ───────────────────────────────────────────────────────
  app.get("/api/support/tickets/:id/messages", supportController.getTicketMessages);
  app.post("/api/support/tickets/:id/messages", supportController.createTicketMessage);

  // ── Ticket AI actions ─────────────────────────────────────────────────────
  app.post("/api/support/tickets/:id/generate-response", supportController.generateResponse);
  app.post("/api/support/tickets/:id/analyze", supportController.analyzeTicketHandler);
  app.post("/api/support/tickets/:id/assign", supportController.assignTicket);
  app.post("/api/support/tickets/:id/escalate", supportController.escalateTicket);

  // ── Support agents ────────────────────────────────────────────────────────
  app.get("/api/support/agents", supportController.getSupportAgents);
  app.get("/api/support/agents/:id", supportController.getSupportAgent);
  app.post("/api/support/agents", supportController.createSupportAgent);
  app.patch("/api/support/agents/:id", supportController.updateSupportAgent);
  app.delete("/api/support/agents/:id", supportController.deleteSupportAgent);

  // ── Escalation rules & dashboard stats ───────────────────────────────────
  app.get("/api/support/escalation-rules", supportController.getEscalationRules);
  app.post("/api/support/check-escalations", supportController.runEscalationCheck);
  app.get("/api/support/stats", supportController.getStats);

  return httpServer;
}
