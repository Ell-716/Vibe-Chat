import type { Request, Response } from "express";
import { storage } from "../storage";
import {
  routeTicket,
  analyzeTicket,
  generateSupportResponse,
  checkEscalations,
} from "../services/support.service";
import {
  sendTicketCreatedEmail,
  sendAgentResponseEmail,
} from "../services/email.service";
import type { TicketStatus, SupportTicket } from "@shared/schema";

// ─── Stats helpers ────────────────────────────────────────────────────────────

/**
 * Calculates the average first-response time across all tickets that have been responded to.
 * @param tickets - Array of support tickets.
 * @returns Average response time in minutes, or 0 if no ticket has been responded to.
 */
function calculateAverageResponseTime(tickets: SupportTicket[]): number {
  const respondedTickets = tickets.filter((t) => t.firstResponseAt);
  if (respondedTickets.length === 0) return 0;

  const totalTime = respondedTickets.reduce((sum, t) => {
    return sum + (new Date(t.firstResponseAt!).getTime() - new Date(t.createdAt).getTime());
  }, 0);

  return Math.round(totalTime / respondedTickets.length / 60000);
}

/**
 * Groups tickets by category and counts each group.
 * @param tickets - Array of support tickets.
 * @returns Map of category name to ticket count.
 */
function calculateTicketsByCategory(tickets: SupportTicket[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const ticket of tickets) {
    result[ticket.category] = (result[ticket.category] || 0) + 1;
  }
  return result;
}

/**
 * Groups tickets by priority and counts each group.
 * @param tickets - Array of support tickets.
 * @returns Map of priority name to ticket count.
 */
function calculateTicketsByPriority(tickets: SupportTicket[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const ticket of tickets) {
    result[ticket.priority] = (result[ticket.priority] || 0) + 1;
  }
  return result;
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

/**
 * GET /api/support/tickets
 * Returns all tickets, optionally filtered by ?status= or ?agentId=.
 */
export async function getTickets(req: Request, res: Response): Promise<void> {
  try {
    const { status, agentId } = req.query;

    let tickets;
    if (status) {
      tickets = await storage.getTicketsByStatus(status as TicketStatus);
    } else if (agentId) {
      tickets = await storage.getTicketsByAgent(agentId as string);
    } else {
      tickets = await storage.getAllTickets();
    }

    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
}

/**
 * GET /api/support/tickets/:id
 * Returns a single ticket with its full message thread.
 */
export async function getTicket(req: Request, res: Response): Promise<void> {
  try {
    const [ticket, messages] = await Promise.all([
      storage.getTicket(req.params.id),
      storage.getTicketMessages(req.params.id),
    ]);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json({ ...ticket, messages });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
}

/**
 * POST /api/support/tickets
 * Creates a ticket, runs AI analysis and routing, and sends a confirmation email.
 * AI failures are caught and logged — ticket creation never blocks on AI errors.
 * @param req.body.subject - Ticket subject (required).
 * @param req.body.description - Full description (required).
 * @param req.body.customerEmail - Customer email address (required).
 * @param req.body.customerName - Customer display name (required).
 * @param req.body.customerId - Optional customer ID; generated from timestamp if absent.
 * @param req.body.category - Optional category hint; overridden by AI analysis.
 * @param req.body.priority - Optional priority hint; overridden by AI analysis.
 */
export async function createTicket(req: Request, res: Response): Promise<void> {
  try {
    const { subject, description, customerId, customerEmail, customerName, category, priority } =
      req.body;

    if (!subject || !description || !customerEmail || !customerName) {
      res.status(400).json({ error: "Subject, description, email, and name are required" });
      return;
    }

    const ticket = await storage.createTicket({
      subject,
      description,
      customerId: customerId || `customer-${Date.now()}`,
      customerEmail,
      customerName,
      category,
      priority,
    });

    // Record the customer's initial message in the ticket thread
    await storage.createTicketMessage({
      ticketId: ticket.id,
      senderId: ticket.customerId,
      senderType: "customer",
      content: description,
      isInternal: false,
    });

    let assignedAgent = null;
    let analysis = null;

    try {
      const routingResult = await routeTicket(ticket);
      assignedAgent = routingResult.assignedAgent;
      analysis = routingResult.analysis;
    } catch (aiError) {
      // AI routing is best-effort — fall back to safe defaults so the ticket is still created
      console.error("AI routing failed, using defaults:", aiError);
      analysis = {
        category: ticket.category,
        priority: ticket.priority,
        summary: "Awaiting manual review",
        suggestedResponse:
          "Thank you for contacting support. An agent will review your request shortly.",
        tags: [],
        sentiment: "neutral",
        requiresEscalation: false,
      };
    }

    const updatedTicket = await storage.getTicket(ticket.id);

    // Email is fire-and-forget — failure does not affect the API response
    sendTicketCreatedEmail(customerEmail, customerName, ticket.id, subject, description).catch(
      (err) => console.error("Email notification failed:", err)
    );

    res.status(201).json({
      ticket: updatedTicket,
      analysis,
      assignedAgent: assignedAgent ? { id: assignedAgent.id, name: assignedAgent.name } : null,
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ error: "Failed to create ticket" });
  }
}

/**
 * PATCH /api/support/tickets/:id
 * Partially updates a ticket's fields. Automatically sets resolvedAt when status → resolved.
 * @param req.body - Any subset of SupportTicket fields to update.
 */
export async function updateTicket(req: Request, res: Response): Promise<void> {
  try {
    const updates = req.body;
    const ticket = await storage.updateTicket(req.params.id, updates);

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    // Record resolution timestamp on first transition to resolved
    if (updates.status === "resolved" && !ticket.resolvedAt) {
      await storage.updateTicket(req.params.id, { resolvedAt: new Date() });
    }

    res.json(ticket);
  } catch (error) {
    console.error("Error updating ticket:", error);
    res.status(500).json({ error: "Failed to update ticket" });
  }
}

/**
 * DELETE /api/support/tickets/:id
 * Deletes a ticket and all its messages.
 */
export async function deleteTicket(req: Request, res: Response): Promise<void> {
  try {
    await storage.deleteTicket(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting ticket:", error);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
}

// ─── Ticket messages ──────────────────────────────────────────────────────────

/**
 * GET /api/support/tickets/:id/messages
 * Returns all messages in a ticket's thread, sorted oldest-first.
 */
export async function getTicketMessages(req: Request, res: Response): Promise<void> {
  try {
    const messages = await storage.getTicketMessages(req.params.id);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

/**
 * POST /api/support/tickets/:id/messages
 * Adds a message to a ticket thread. Updates ticket status and sends email when
 * an agent posts a public (non-internal) reply for the first time.
 * @param req.body.content - Message text (required).
 * @param req.body.senderId - ID of the sender (required).
 * @param req.body.senderType - "customer" | "agent" | "system" (required).
 * @param req.body.isInternal - Whether the message is an internal note. Defaults to false.
 */
export async function createTicketMessage(req: Request, res: Response): Promise<void> {
  try {
    const { content, senderId, senderType, isInternal } = req.body;

    if (!content || !senderId || !senderType) {
      res.status(400).json({ error: "Content, senderId, and senderType are required" });
      return;
    }

    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const message = await storage.createTicketMessage({
      ticketId: req.params.id,
      senderId,
      senderType,
      content,
      isInternal: isInternal || false,
    });

    // First agent reply marks the ticket as in-progress and records response time
    if (senderType === "agent" && !ticket.firstResponseAt) {
      await storage.updateTicket(req.params.id, {
        firstResponseAt: new Date(),
        status: "in_progress",
      });
    }

    // Send email notification for public agent replies
    if (senderType === "agent" && !isInternal) {
      let agentName = "Support Agent";
      if (ticket.assignedAgentId) {
        const agent = await storage.getSupportAgent(ticket.assignedAgentId);
        if (agent) agentName = agent.name;
      }

      sendAgentResponseEmail(
        ticket.customerEmail,
        ticket.customerName,
        ticket.id,
        ticket.subject,
        agentName,
        content
      ).catch((err) => console.error("Agent response email failed:", err));
    }

    res.status(201).json(message);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: "Failed to create message" });
  }
}

// ─── AI actions ───────────────────────────────────────────────────────────────

/**
 * POST /api/support/tickets/:id/generate-response
 * Uses AI to draft a suggested agent response based on the ticket subject,
 * description, and full conversation history.
 */
export async function generateResponse(req: Request, res: Response): Promise<void> {
  try {
    const [ticket, messages] = await Promise.all([
      storage.getTicket(req.params.id),
      storage.getTicketMessages(req.params.id),
    ]);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const conversationHistory = messages.map(
      (m) => `${m.senderType === "customer" ? "Customer" : "Agent"}: ${m.content}`
    );

    let agentName = "Support Agent";
    if (ticket.assignedAgentId) {
      const agent = await storage.getSupportAgent(ticket.assignedAgentId);
      if (agent) agentName = agent.name;
    }

    let suggestedResponse: string;
    try {
      suggestedResponse = await generateSupportResponse(
        ticket.subject,
        ticket.description,
        conversationHistory,
        agentName
      );
    } catch (aiError) {
      console.error("AI response generation failed:", aiError);
      suggestedResponse = `Dear ${ticket.customerName},\n\nThank you for reaching out to our support team. We have received your inquiry regarding "${ticket.subject}" and are looking into it.\n\nWe will get back to you as soon as possible.\n\nBest regards,\n${agentName}`;
    }

    res.json({ suggestedResponse });
  } catch (error) {
    console.error("Error generating response:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
}

/**
 * POST /api/support/tickets/:id/analyze
 * Runs AI analysis on a ticket and persists the suggested category, priority, tags, and summary.
 */
export async function analyzeTicketHandler(req: Request, res: Response): Promise<void> {
  try {
    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const analysis = await analyzeTicket(ticket.subject, ticket.description);

    await storage.updateTicket(req.params.id, {
      aiSuggestedCategory: analysis.category,
      aiSuggestedPriority: analysis.priority,
      aiSummary: analysis.summary,
      aiSuggestedResponse: analysis.suggestedResponse,
      tags: analysis.tags,
    });

    res.json(analysis);
  } catch (error) {
    console.error("Error analyzing ticket:", error);
    res.status(500).json({ error: "Failed to analyze ticket" });
  }
}

/**
 * POST /api/support/tickets/:id/assign
 * Assigns a ticket to a support agent, adjusting ticket-count bookkeeping for both
 * the previous agent (if any) and the newly assigned agent.
 * @param req.body.agentId - ID of the agent to assign (required).
 */
export async function assignTicket(req: Request, res: Response): Promise<void> {
  try {
    const { agentId } = req.body;

    const [ticket, agent] = await Promise.all([
      storage.getTicket(req.params.id),
      storage.getSupportAgent(agentId),
    ]);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    // Decrement previous agent's workload before reassigning
    if (ticket.assignedAgentId) {
      const previousAgent = await storage.getSupportAgent(ticket.assignedAgentId);
      if (previousAgent) {
        await storage.updateSupportAgent(previousAgent.id, {
          currentTicketCount: Math.max(0, previousAgent.currentTicketCount - 1),
        });
      }
    }

    await storage.updateSupportAgent(agentId, {
      currentTicketCount: agent.currentTicketCount + 1,
    });

    const updatedTicket = await storage.updateTicket(req.params.id, {
      assignedAgentId: agentId,
      status: ticket.status === "open" ? "in_progress" : ticket.status,
    });

    await storage.createTicketMessage({
      ticketId: req.params.id,
      senderId: "system",
      senderType: "system",
      content: `Ticket assigned to ${agent.name}`,
      isInternal: true,
    });

    res.json(updatedTicket);
  } catch (error) {
    console.error("Error assigning ticket:", error);
    res.status(500).json({ error: "Failed to assign ticket" });
  }
}

/**
 * POST /api/support/tickets/:id/escalate
 * Escalates a ticket to a higher level with an optional reason.
 * @param req.body.reason - Human-readable escalation reason. Defaults to "Manual escalation".
 * @param req.body.level - Target escalation level. Defaults to current level + 1.
 */
export async function escalateTicket(req: Request, res: Response): Promise<void> {
  try {
    const { reason, level } = req.body;

    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const updatedTicket = await storage.updateTicket(req.params.id, {
      status: "escalated",
      escalationReason: reason || "Manual escalation",
      escalationLevel: level || ticket.escalationLevel + 1,
    });

    await storage.createTicketMessage({
      ticketId: req.params.id,
      senderId: "system",
      senderType: "system",
      content: `Ticket escalated to level ${level || ticket.escalationLevel + 1}. Reason: ${reason || "Manual escalation"}`,
      isInternal: true,
    });

    res.json(updatedTicket);
  } catch (error) {
    console.error("Error escalating ticket:", error);
    res.status(500).json({ error: "Failed to escalate ticket" });
  }
}

// ─── Support agents ───────────────────────────────────────────────────────────

/**
 * GET /api/support/agents
 * Returns all support agents.
 */
export async function getSupportAgents(_req: Request, res: Response): Promise<void> {
  try {
    const agents = await storage.getAllSupportAgents();
    res.json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
}

/**
 * GET /api/support/agents/:id
 * Returns a single support agent with their currently assigned tickets.
 */
export async function getSupportAgent(req: Request, res: Response): Promise<void> {
  try {
    const [agent, tickets] = await Promise.all([
      storage.getSupportAgent(req.params.id),
      storage.getTicketsByAgent(req.params.id),
    ]);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json({ ...agent, assignedTickets: tickets });
  } catch (error) {
    console.error("Error fetching agent:", error);
    res.status(500).json({ error: "Failed to fetch agent" });
  }
}

/**
 * POST /api/support/agents
 * Creates a new support agent with at least one skill.
 * @param req.body.name - Agent name (required).
 * @param req.body.email - Agent email (required).
 * @param req.body.skills - Array of TicketCategory values (required, non-empty).
 * @param req.body.maxTickets - Optional max concurrent ticket limit.
 */
export async function createSupportAgent(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, skills, maxTickets } = req.body;

    if (!name || !email || !skills || skills.length === 0) {
      res.status(400).json({ error: "Name, email, and at least one skill are required" });
      return;
    }

    const agent = await storage.createSupportAgent({ name, email, skills, maxTickets });
    res.status(201).json(agent);
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({ error: "Failed to create agent" });
  }
}

/**
 * PATCH /api/support/agents/:id
 * Partially updates a support agent's fields (e.g. availability, max tickets).
 */
export async function updateSupportAgent(req: Request, res: Response): Promise<void> {
  try {
    const agent = await storage.updateSupportAgent(req.params.id, req.body);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(agent);
  } catch (error) {
    console.error("Error updating agent:", error);
    res.status(500).json({ error: "Failed to update agent" });
  }
}

/**
 * DELETE /api/support/agents/:id
 * Deletes a support agent.
 */
export async function deleteSupportAgent(req: Request, res: Response): Promise<void> {
  try {
    await storage.deleteSupportAgent(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting agent:", error);
    res.status(500).json({ error: "Failed to delete agent" });
  }
}

// ─── Escalation rules & stats ─────────────────────────────────────────────────

/**
 * GET /api/support/escalation-rules
 * Returns all configured escalation rules.
 */
export async function getEscalationRules(_req: Request, res: Response): Promise<void> {
  try {
    const rules = await storage.getAllEscalationRules();
    res.json(rules);
  } catch (error) {
    console.error("Error fetching escalation rules:", error);
    res.status(500).json({ error: "Failed to fetch escalation rules" });
  }
}

/**
 * POST /api/support/check-escalations
 * Runs the auto-escalation engine against all open tickets and returns which
 * tickets were escalated during this run.
 */
export async function runEscalationCheck(_req: Request, res: Response): Promise<void> {
  try {
    const escalatedTickets = await checkEscalations();
    res.json({ escalatedCount: escalatedTickets.length, tickets: escalatedTickets });
  } catch (error) {
    console.error("Error checking escalations:", error);
    res.status(500).json({ error: "Failed to check escalations" });
  }
}

/**
 * GET /api/support/stats
 * Returns aggregate support dashboard statistics: ticket counts by status/category/priority,
 * average response time, SLA breaches, and agent availability.
 */
export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const [tickets, agents] = await Promise.all([
      storage.getAllTickets(),
      storage.getAllSupportAgents(),
    ]);

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      totalTickets: tickets.length,
      openTickets: tickets.filter((t) => t.status === "open").length,
      inProgressTickets: tickets.filter((t) => t.status === "in_progress").length,
      escalatedTickets: tickets.filter((t) => t.status === "escalated").length,
      resolvedToday: tickets.filter(
        (t) => t.resolvedAt && new Date(t.resolvedAt) > oneDayAgo
      ).length,
      averageResponseTime: calculateAverageResponseTime(tickets),
      ticketsByCategory: calculateTicketsByCategory(tickets),
      ticketsByPriority: calculateTicketsByPriority(tickets),
      agentsOnline: agents.filter((a) => a.isOnline).length,
      totalAgents: agents.length,
      slaBreaches: tickets.filter(
        (t) =>
          t.slaDeadline &&
          new Date(t.slaDeadline) < now &&
          t.status !== "resolved" &&
          t.status !== "closed"
      ).length,
    };

    res.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}
