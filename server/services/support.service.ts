import OpenAI from "openai";
import { storage } from "../storage";
import { env } from "../config/env";
import type {
  SupportTicket,
  TicketCategory,
  TicketPriority,
  SupportAgent,
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export interface TicketAnalysis {
  category: TicketCategory;
  priority: TicketPriority;
  summary: string;
  suggestedResponse: string;
  tags: string[];
  sentiment: "positive" | "neutral" | "negative" | "frustrated";
  requiresEscalation: boolean;
  escalationReason?: string;
}

/**
 * Uses GPT-4o-mini to classify and summarise a support ticket.
 * Returns safe defaults on AI failure so ticket creation is never blocked.
 * @param subject - The ticket subject line.
 * @param description - The full ticket description from the customer.
 * @returns A structured analysis including category, priority, sentiment, and a suggested reply.
 */
export async function analyzeTicket(
  subject: string,
  description: string
): Promise<TicketAnalysis> {
  const systemPrompt = `You are an AI support ticket analyzer. Analyze the following support ticket and provide:
1. Category (one of: billing, technical, account, feature_request, bug_report, general)
2. Priority (one of: low, medium, high, urgent)
3. A brief summary (1-2 sentences)
4. A suggested response to the customer
5. Relevant tags (up to 5)
6. Customer sentiment (positive, neutral, negative, or frustrated)
7. Whether it requires escalation to a supervisor
8. Escalation reason if applicable

Consider urgency indicators like:
- "urgent", "asap", "immediately" -> high/urgent priority
- Account security issues -> urgent priority
- Payment failures -> high priority
- Feature requests -> low priority
- Bug reports -> medium/high depending on severity

Respond in JSON format with these exact fields:
{
  "category": "...",
  "priority": "...",
  "summary": "...",
  "suggestedResponse": "...",
  "tags": ["...", "..."],
  "sentiment": "...",
  "requiresEscalation": true/false,
  "escalationReason": "..." (optional)
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Subject: ${subject}\n\nDescription: ${description}` },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    return JSON.parse(content) as TicketAnalysis;
  } catch (error) {
    console.error("Error analyzing ticket:", error);
    return {
      category: "general",
      priority: "medium",
      summary: "Unable to analyze ticket automatically",
      suggestedResponse:
        "Thank you for reaching out. A support agent will review your request shortly.",
      tags: [],
      sentiment: "neutral",
      requiresEscalation: false,
    };
  }
}

/**
 * Generates a professional agent response draft for an open ticket using GPT-4o-mini.
 * @param ticketSubject - The original ticket subject.
 * @param ticketDescription - The original ticket description.
 * @param conversationHistory - Prior messages in the ticket thread formatted as "Role: content" strings.
 * @param agentName - The name to sign the response as.
 * @returns A suggested response string ready for the agent to review and send.
 */
export async function generateSupportResponse(
  ticketSubject: string,
  ticketDescription: string,
  conversationHistory: string[],
  agentName: string
): Promise<string> {
  const systemPrompt = `You are ${agentName}, a professional and empathetic customer support agent.
Generate a helpful, friendly response to the customer's inquiry.

Guidelines:
- Be polite and professional
- Acknowledge the customer's concern
- Provide clear, actionable information
- Use simple language
- Offer next steps if applicable
- Keep the response concise but complete
- Sign off appropriately`;

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Original ticket:\nSubject: ${ticketSubject}\n${ticketDescription}` },
  ];

  if (conversationHistory.length > 0) {
    messages.push({
      role: "user",
      content: `Previous conversation:\n${conversationHistory.join("\n\n")}`,
    });
  }

  messages.push({
    role: "user",
    content: "Generate a professional response to continue helping this customer.",
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_completion_tokens: 1024,
    });

    return (
      response.choices[0]?.message?.content ||
      "I apologize, but I need more information to assist you better."
    );
  } catch (error) {
    console.error("Error generating support response:", error);
    throw error;
  }
}

/**
 * Finds the best available support agent for a ticket based on skill match and workload.
 * Prefers agents with matching category skills, then sorts by satisfaction score for
 * high/urgent tickets or by workload ratio for lower priorities.
 * Falls back to any online agent with capacity if no skill-matched agent is available.
 * @param category - The ticket category to match against agent skills.
 * @param priority - The ticket priority, used to bias agent selection for critical tickets.
 * @returns The best matching SupportAgent, or null if no agent is available.
 */
export async function findBestAgentForTicket(
  category: TicketCategory,
  priority: TicketPriority
): Promise<SupportAgent | null> {
  const availableAgents = await storage.getAvailableAgentsForCategory(category);

  if (availableAgents.length === 0) {
    // No skill-matched agent available — fall back to any online agent with capacity
    const allAgents = await storage.getAllSupportAgents();
    const onlineAgents = allAgents.filter(
      (a) => a.isOnline && a.currentTicketCount < a.maxTickets
    );
    if (onlineAgents.length === 0) return null;

    onlineAgents.sort(
      (a, b) => a.currentTicketCount / a.maxTickets - b.currentTicketCount / b.maxTickets
    );
    return onlineAgents[0];
  }

  // For high-priority tickets, weight satisfaction score alongside available capacity
  if (priority === "urgent" || priority === "high") {
    availableAgents.sort((a, b) => {
      const scoreA = a.satisfactionScore * (1 - a.currentTicketCount / a.maxTickets);
      const scoreB = b.satisfactionScore * (1 - b.currentTicketCount / b.maxTickets);
      return scoreB - scoreA;
    });
  }

  return availableAgents[0];
}

/**
 * Analyses a ticket with AI, assigns it to the best available agent, and persists
 * the AI suggestions and assignment back to storage.
 * @param ticket - The newly created ticket to route.
 * @returns The assigned agent (or null) and the full AI analysis result.
 */
export async function routeTicket(ticket: SupportTicket): Promise<{
  assignedAgent: SupportAgent | null;
  analysis: TicketAnalysis;
}> {
  const analysis = await analyzeTicket(ticket.subject, ticket.description);
  const agent = await findBestAgentForTicket(analysis.category, analysis.priority);

  await storage.updateTicket(ticket.id, {
    aiSuggestedCategory: analysis.category,
    aiSuggestedPriority: analysis.priority,
    aiSummary: analysis.summary,
    aiSuggestedResponse: analysis.suggestedResponse,
    tags: analysis.tags,
    category: analysis.category,
    priority: analysis.priority,
    assignedAgentId: agent?.id || null,
  });

  if (agent) {
    await storage.updateSupportAgent(agent.id, {
      currentTicketCount: agent.currentTicketCount + 1,
    });
  }

  return { assignedAgent: agent, analysis };
}

/**
 * Checks all open tickets against active escalation rules and auto-escalates
 * any ticket that has exceeded its rule's time threshold.
 * Skips tickets that are already resolved, closed, or escalated.
 * @returns Array of tickets that were escalated during this run.
 */
export async function checkEscalations(): Promise<SupportTicket[]> {
  const rules = await storage.getActiveEscalationRules();
  const allTickets = await storage.getAllTickets();
  const now = new Date();
  const escalatedTickets: SupportTicket[] = [];

  for (const ticket of allTickets) {
    if (
      ticket.status === "resolved" ||
      ticket.status === "closed" ||
      ticket.status === "escalated"
    ) {
      continue;
    }

    for (const rule of rules) {
      // Skip rules that don't match this ticket's category or priority
      if (rule.category && rule.category !== ticket.category) continue;
      if (rule.priority !== ticket.priority) continue;

      const ticketAgeMinutes = (now.getTime() - new Date(ticket.createdAt).getTime()) / 60000;

      if (ticketAgeMinutes >= rule.triggerAfterMinutes && ticket.escalationLevel < rule.escalateToLevel) {
        const updatedTicket = await storage.updateTicket(ticket.id, {
          status: "escalated",
          escalationLevel: rule.escalateToLevel,
          escalationReason: `Auto-escalated: ${rule.name}`,
        });

        if (updatedTicket) {
          escalatedTickets.push(updatedTicket);

          await storage.createTicketMessage({
            ticketId: ticket.id,
            senderId: "system",
            senderType: "system",
            content: `Ticket escalated to level ${rule.escalateToLevel}. Reason: ${rule.name}`,
            isInternal: true,
          });
        }

        // Only apply one rule per ticket per check cycle
        break;
      }
    }
  }

  return escalatedTickets;
}
