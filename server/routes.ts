import type { Express } from "express";
import type { Server } from "http";
import rateLimit from "express-rate-limit";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { env } from "./config/env";
import * as chatController from "./controllers/chat.controller";
import * as agentController from "./controllers/agent.controller";
import * as ragController from "./controllers/rag.controller";
import * as supportController from "./controllers/support.controller";
import * as authController from "./controllers/auth.controller";
import * as userController from "./controllers/user.controller";
import * as multiAgentController from "./controllers/multiAgent.controller";
import * as promptImprovementController from "./controllers/promptImprovement.controller";
import { requireAuth } from "./middleware/requireAuth";

/**
 * Registers all application routes on the Express app.
 * Auth routes are mounted first (no authentication required).
 * All /api routes are protected by requireAuth middleware.
 * This file contains only route declarations — all request handling
 * and business logic lives in controllers/ and services/.
 * @param httpServer - The underlying HTTP server (returned unchanged).
 * @param app - The Express application instance.
 * @returns The HTTP server, for chaining in index.ts.
 */
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ── Health check (public) ─────────────────────────────────────────────────
  app.get("/health", async (_req, res) => {
    if (!env.DATABASE_URL) {
      res.json({ status: "ok", db: "not configured", uptime: process.uptime() });
      return;
    }
    try {
      await db.execute(sql`SELECT 1`);
      res.json({ status: "ok", db: "connected", uptime: process.uptime() });
    } catch {
      res.status(503).json({ status: "error", db: "unreachable", uptime: process.uptime() });
    }
  });

  // ── Auth (public — no requireAuth) ────────────────────────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,                   // per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many auth attempts, please try again later" },
  });

  app.get("/auth/google", authLimiter, authController.initiateGoogleAuth);
  app.get(
    "/auth/google/callback",
    authLimiter,
    authController.googleCallback,
    authController.googleCallbackSuccess
  );
  app.post("/auth/logout", authController.logout);
  app.get("/auth/me", authController.getMe);

  // ── Multi-agent: public static config (registered before requireAuth) ─────
  app.get("/api/multi-agent/agents", multiAgentController.getAgentConfigs);

  // ── Protect all /api routes ───────────────────────────────────────────────
  app.use("/api", requireAuth);

  // ── User settings ─────────────────────────────────────────────────────────
  app.get("/api/user/me", userController.getMe);
  app.patch("/api/user/profile", userController.updateProfile);
  app.patch("/api/user/preferences", userController.updatePreferences);
  app.delete("/api/user/account", userController.deleteAccount);

  // ── Conversations ──────────────────────────────────────────────────────────
  app.get("/api/conversations", chatController.getConversations);
  app.get("/api/conversations/:id", chatController.getConversation);
  app.post("/api/conversations", chatController.createConversation);
  app.patch("/api/conversations/:id", chatController.updateConversation);
  app.delete("/api/conversations/:id", chatController.deleteConversation);

  // ── Chat / messaging ───────────────────────────────────────────────────────
  const llmLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,             // per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many messages, please wait a moment" },
  });

  app.post("/api/conversations/:id/messages", llmLimiter, chatController.sendMessage);

  // ── Models & channels ──────────────────────────────────────────────────────
  app.get("/api/models", chatController.getModels);
  app.get("/api/channels/status", chatController.getChannelStatus);

  // ── Voice (ElevenLabs) ────────────────────────────────────────────────────
  const voiceLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,             // per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many voice requests, please wait a moment" },
  });

  app.post("/api/text-to-speech", voiceLimiter, chatController.textToSpeech);
  app.get("/api/voices", chatController.listVoices);
  app.post("/api/speech-to-text", voiceLimiter, chatController.speechToTextHandler);

  // ── AI agents ─────────────────────────────────────────────────────────────
  app.get("/api/agents", agentController.getAgents);
  app.get("/api/agents/:id", agentController.getAgent);
  app.post("/api/agents", agentController.createAgent);
  app.patch("/api/agents/:id", agentController.updateAgent);
  app.delete("/api/agents/:id", agentController.deleteAgent);

  // ── RAG documents ─────────────────────────────────────────────────────────
  const documentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,              // per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many document requests, please wait a moment" },
  });

  app.post(
    "/api/documents/upload",
    documentLimiter,
    ragController.uploadMiddleware.single("file"),
    ragController.uploadDocument
  );
  app.get("/api/documents", ragController.listDocuments);
  app.post("/api/documents/:id/summarize", documentLimiter, ragController.summarizeDocumentHandler);
  app.delete("/api/documents/:id", ragController.removeDocument);

  // ── MCP (Zapier) ──────────────────────────────────────────────────────────
  app.get("/api/mcp/tools", ragController.getMcpTools);
  app.post("/api/mcp/execute", ragController.executeMcp);

  // ── Multi-agent conversation ──────────────────────────────────────────────
  const multiAgentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 15,             // per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many agent requests, please wait a moment" },
  });

  app.post("/api/multi-agent/turn", multiAgentLimiter, multiAgentController.runTurn);

  // ── Prompt improvement (self-improving agents) ────────────────────────────
  app.post("/api/multi-agent/feedback", promptImprovementController.submitFeedback);
  app.post("/api/multi-agent/improve", multiAgentLimiter, promptImprovementController.runImprovement);
  app.get("/api/multi-agent/agents/:agentId/prompt-history", promptImprovementController.getAgentPromptHistory);

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
