import type { Express } from "express";
import { storage } from "./storage";
import { analyzeTicket, routeTicket, generateSupportResponse, checkEscalations } from "./support-ai";
import type { TicketStatus, TicketCategory, TicketPriority } from "@shared/schema";

export function registerSupportRoutes(app: Express): void {
  app.get("/api/support/tickets", async (req, res) => {
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
  });

  app.get("/api/support/tickets/:id", async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      const messages = await storage.getTicketMessages(req.params.id);
      res.json({ ...ticket, messages });
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  app.post("/api/support/tickets", async (req, res) => {
    try {
      const { subject, description, customerId, customerEmail, customerName, category, priority } = req.body;
      
      if (!subject || !description || !customerEmail || !customerName) {
        return res.status(400).json({ error: "Subject, description, email, and name are required" });
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
        console.error("AI routing failed, using defaults:", aiError);
        analysis = {
          category: ticket.category,
          priority: ticket.priority,
          summary: "Awaiting manual review",
          suggestedResponse: "Thank you for contacting support. An agent will review your request shortly.",
          tags: [],
          sentiment: "neutral",
          requiresEscalation: false,
        };
      }

      const updatedTicket = await storage.getTicket(ticket.id);

      res.status(201).json({
        ticket: updatedTicket,
        analysis,
        assignedAgent: assignedAgent ? { id: assignedAgent.id, name: assignedAgent.name } : null,
      });
    } catch (error) {
      console.error("Error creating ticket:", error);
      res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  app.patch("/api/support/tickets/:id", async (req, res) => {
    try {
      const updates = req.body;
      const ticket = await storage.updateTicket(req.params.id, updates);
      
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      if (updates.status === "resolved" && !ticket.resolvedAt) {
        await storage.updateTicket(req.params.id, { resolvedAt: new Date() });
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ error: "Failed to update ticket" });
    }
  });

  app.delete("/api/support/tickets/:id", async (req, res) => {
    try {
      await storage.deleteTicket(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting ticket:", error);
      res.status(500).json({ error: "Failed to delete ticket" });
    }
  });

  app.get("/api/support/tickets/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getTicketMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/support/tickets/:id/messages", async (req, res) => {
    try {
      const { content, senderId, senderType, isInternal } = req.body;
      
      if (!content || !senderId || !senderType) {
        return res.status(400).json({ error: "Content, senderId, and senderType are required" });
      }

      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const message = await storage.createTicketMessage({
        ticketId: req.params.id,
        senderId,
        senderType,
        content,
        isInternal: isInternal || false,
      });

      if (senderType === "agent" && !ticket.firstResponseAt) {
        await storage.updateTicket(req.params.id, { 
          firstResponseAt: new Date(),
          status: "in_progress"
        });
      }

      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.post("/api/support/tickets/:id/generate-response", async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const messages = await storage.getTicketMessages(req.params.id);
      const conversationHistory = messages.map(m => 
        `${m.senderType === "customer" ? "Customer" : "Agent"}: ${m.content}`
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
  });

  app.post("/api/support/tickets/:id/analyze", async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
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
  });

  app.post("/api/support/tickets/:id/assign", async (req, res) => {
    try {
      const { agentId } = req.body;
      
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const agent = await storage.getSupportAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

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
  });

  app.post("/api/support/tickets/:id/escalate", async (req, res) => {
    try {
      const { reason, level } = req.body;
      
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
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
  });

  app.get("/api/support/agents", async (req, res) => {
    try {
      const agents = await storage.getAllSupportAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/support/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getSupportAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const tickets = await storage.getTicketsByAgent(req.params.id);
      res.json({ ...agent, assignedTickets: tickets });
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ error: "Failed to fetch agent" });
    }
  });

  app.post("/api/support/agents", async (req, res) => {
    try {
      const { name, email, skills, maxTickets } = req.body;
      
      if (!name || !email || !skills || skills.length === 0) {
        return res.status(400).json({ error: "Name, email, and at least one skill are required" });
      }

      const agent = await storage.createSupportAgent({
        name,
        email,
        skills,
        maxTickets,
      });

      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.patch("/api/support/agents/:id", async (req, res) => {
    try {
      const agent = await storage.updateSupportAgent(req.params.id, req.body);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/support/agents/:id", async (req, res) => {
    try {
      await storage.deleteSupportAgent(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  app.get("/api/support/escalation-rules", async (req, res) => {
    try {
      const rules = await storage.getAllEscalationRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching escalation rules:", error);
      res.status(500).json({ error: "Failed to fetch escalation rules" });
    }
  });

  app.post("/api/support/check-escalations", async (req, res) => {
    try {
      const escalatedTickets = await checkEscalations();
      res.json({ escalatedCount: escalatedTickets.length, tickets: escalatedTickets });
    } catch (error) {
      console.error("Error checking escalations:", error);
      res.status(500).json({ error: "Failed to check escalations" });
    }
  });

  app.get("/api/support/stats", async (req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      const agents = await storage.getAllSupportAgents();
      
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const stats = {
        totalTickets: tickets.length,
        openTickets: tickets.filter(t => t.status === "open").length,
        inProgressTickets: tickets.filter(t => t.status === "in_progress").length,
        escalatedTickets: tickets.filter(t => t.status === "escalated").length,
        resolvedToday: tickets.filter(t => 
          t.resolvedAt && new Date(t.resolvedAt) > oneDayAgo
        ).length,
        averageResponseTime: calculateAverageResponseTime(tickets),
        ticketsByCategory: calculateTicketsByCategory(tickets),
        ticketsByPriority: calculateTicketsByPriority(tickets),
        agentsOnline: agents.filter(a => a.isOnline).length,
        totalAgents: agents.length,
        slaBreaches: tickets.filter(t => 
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
  });
}

function calculateAverageResponseTime(tickets: any[]): number {
  const respondedTickets = tickets.filter(t => t.firstResponseAt);
  if (respondedTickets.length === 0) return 0;
  
  const totalTime = respondedTickets.reduce((sum, t) => {
    return sum + (new Date(t.firstResponseAt!).getTime() - new Date(t.createdAt).getTime());
  }, 0);
  
  return Math.round(totalTime / respondedTickets.length / 60000);
}

function calculateTicketsByCategory(tickets: any[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const ticket of tickets) {
    result[ticket.category] = (result[ticket.category] || 0) + 1;
  }
  return result;
}

function calculateTicketsByPriority(tickets: any[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const ticket of tickets) {
    result[ticket.priority] = (result[ticket.priority] || 0) + 1;
  }
  return result;
}
