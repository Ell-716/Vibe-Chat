import { eq, desc, asc, and } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  conversations,
  messages,
  agents as agentsTable,
  supportTickets as supportTicketsTable,
  ticketMessages as ticketMessagesTable,
  supportAgents as supportAgentsTable,
  escalationRules as escalationRulesTable,
  defaultAgents,
  defaultSupportAgents,
  defaultEscalationRules,
} from "@shared/schema";
import type {
  User,
  InsertUser,
  Conversation,
  Message,
  Agent,
  SupportTicket,
  TicketMessage,
  SupportAgent,
  EscalationRule,
  InsertSupportTicket,
  InsertTicketMessage,
  InsertSupportAgent,
  TicketPriority,
  TicketStatus,
  TicketCategory,
} from "@shared/schema";
import type { IStorage } from "./storage";
import { randomUUID } from "crypto";

// ─── Row → domain type mappers ────────────────────────────────────────────────

/**
 * Maps a Drizzle agents row to the Agent domain interface.
 * @param row - Raw row from the agents table.
 * @returns Agent domain object.
 */
function rowToAgent(row: typeof agentsTable.$inferSelect): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    systemPrompt: row.systemPrompt,
    icon: row.icon,
    isDefault: row.isDefault ?? undefined,
  };
}

/**
 * Maps a Drizzle support_tickets row to the SupportTicket domain interface.
 * @param row - Raw row from the support_tickets table.
 * @returns SupportTicket domain object with correctly typed enums and arrays.
 */
function rowToSupportTicket(row: typeof supportTicketsTable.$inferSelect): SupportTicket {
  return {
    id: row.id,
    subject: row.subject,
    description: row.description,
    category: row.category as TicketCategory,
    priority: row.priority as TicketPriority,
    status: row.status as TicketStatus,
    customerId: row.customerId,
    customerEmail: row.customerEmail,
    customerName: row.customerName,
    assignedAgentId: row.assignedAgentId ?? null,
    aiSuggestedCategory: (row.aiSuggestedCategory as TicketCategory) ?? null,
    aiSuggestedPriority: (row.aiSuggestedPriority as TicketPriority) ?? null,
    aiSummary: row.aiSummary ?? null,
    aiSuggestedResponse: row.aiSuggestedResponse ?? null,
    escalationReason: row.escalationReason ?? null,
    escalationLevel: row.escalationLevel,
    slaDeadline: row.slaDeadline ?? null,
    firstResponseAt: row.firstResponseAt ?? null,
    resolvedAt: row.resolvedAt ?? null,
    tags: (row.tags as string[]) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Maps a Drizzle ticket_messages row to the TicketMessage domain interface.
 * @param row - Raw row from the ticket_messages table.
 * @returns TicketMessage domain object.
 */
function rowToTicketMessage(row: typeof ticketMessagesTable.$inferSelect): TicketMessage {
  return {
    id: row.id,
    ticketId: row.ticketId,
    senderId: row.senderId,
    senderType: row.senderType as "customer" | "agent" | "system",
    content: row.content,
    isInternal: row.isInternal,
    createdAt: row.createdAt,
  };
}

/**
 * Maps a Drizzle support_agents row to the SupportAgent domain interface.
 * @param row - Raw row from the support_agents table.
 * @returns SupportAgent domain object.
 */
function rowToSupportAgent(row: typeof supportAgentsTable.$inferSelect): SupportAgent {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    skills: (row.skills as TicketCategory[]) ?? [],
    maxTickets: row.maxTickets,
    currentTicketCount: row.currentTicketCount,
    isAvailable: row.isAvailable,
    isOnline: row.isOnline,
    averageResponseTime: row.averageResponseTime,
    satisfactionScore: row.satisfactionScore,
    createdAt: row.createdAt,
  };
}

/**
 * Maps a Drizzle escalation_rules row to the EscalationRule domain interface.
 * @param row - Raw row from the escalation_rules table.
 * @returns EscalationRule domain object.
 */
function rowToEscalationRule(row: typeof escalationRulesTable.$inferSelect): EscalationRule {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority as TicketPriority,
    category: (row.category as TicketCategory) ?? null,
    triggerAfterMinutes: row.triggerAfterMinutes,
    escalateToLevel: row.escalateToLevel,
    notifyManagement: row.notifyManagement,
    isActive: row.isActive,
  };
}

// ─── DatabaseStorage ─────────────────────────────────────────────────────────

/**
 * PostgreSQL-backed implementation of IStorage using Drizzle ORM.
 * Data is persisted across server restarts. Default agents, support agents,
 * and escalation rules are seeded on first boot when their tables are empty.
 */
export class DatabaseStorage implements IStorage {
  constructor() {
    // Seed defaults in the background; resolves before any real request
    this.initialize().catch((err) =>
      console.error("[db] Seed initialization failed:", err)
    );
  }

  /**
   * Seeds default agents, support agents, and escalation rules if the
   * respective tables are empty. Safe to call multiple times (idempotent).
   */
  async initialize(): Promise<void> {
    const [agentRows, supportAgentRows, ruleRows] = await Promise.all([
      db.select().from(agentsTable).limit(1),
      db.select().from(supportAgentsTable).limit(1),
      db.select().from(escalationRulesTable).limit(1),
    ]);

    await Promise.all([
      agentRows.length === 0
        ? db.insert(agentsTable).values(
            defaultAgents.map((a) => ({
              id: a.id,
              name: a.name,
              description: a.description,
              systemPrompt: a.systemPrompt,
              icon: a.icon,
              isDefault: a.isDefault ?? false,
            }))
          )
        : Promise.resolve(),

      supportAgentRows.length === 0
        ? db.insert(supportAgentsTable).values(
            defaultSupportAgents.map((a) => ({
              id: a.id,
              name: a.name,
              email: a.email,
              skills: a.skills,
              maxTickets: a.maxTickets,
              currentTicketCount: a.currentTicketCount,
              isAvailable: a.isAvailable,
              isOnline: a.isOnline,
              averageResponseTime: a.averageResponseTime,
              satisfactionScore: a.satisfactionScore,
            }))
          )
        : Promise.resolve(),

      ruleRows.length === 0
        ? db.insert(escalationRulesTable).values(
            defaultEscalationRules.map((r) => ({
              id: r.id,
              name: r.name,
              priority: r.priority,
              category: r.category ?? null,
              triggerAfterMinutes: r.triggerAfterMinutes,
              escalateToLevel: r.escalateToLevel,
              notifyManagement: r.notifyManagement,
              isActive: r.isActive,
            }))
          )
        : Promise.resolve(),
    ]);
  }

  // ─── User methods ───────────────────────────────────────────────────────────

  /**
   * Retrieves a user by their UUID.
   * @param id - The user's UUID.
   * @returns The matching User, or undefined if not found.
   */
  async getUser(id: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row;
  }

  /**
   * Retrieves a user by their Google OAuth ID.
   * @param googleId - The Google account ID string.
   * @returns The matching User, or undefined if not found.
   */
  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId));
    return row;
  }

  /**
   * Retrieves a user by their email address.
   * @param email - The email address to look up.
   * @returns The matching User, or undefined if not found.
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return row;
  }

  /**
   * Creates and persists a new user.
   * @param insertUser - User fields (googleId, email, name, avatar).
   * @returns The newly created User including its generated id and timestamps.
   */
  async createUser(insertUser: InsertUser): Promise<User> {
    const [row] = await db.insert(users).values(insertUser).returning();
    return row;
  }

  /**
   * Applies a partial update to a user record and stamps updatedAt.
   * @param id - The user's UUID.
   * @param data - Partial User fields to merge in.
   * @returns The updated User, or undefined if not found.
   */
  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [row] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return row;
  }

  // ─── Conversation methods ───────────────────────────────────────────────────

  /**
   * Retrieves a conversation by its numeric ID.
   * @param id - The conversation's integer ID.
   * @returns The matching Conversation, or undefined if not found.
   */
  async getConversation(id: number): Promise<Conversation | undefined> {
    const [row] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return row;
  }

  /**
   * Returns all conversations sorted newest-first.
   * @returns Array of all Conversation records.
   */
  async getAllConversations(): Promise<Conversation[]> {
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  }

  /**
   * Creates and persists a new conversation.
   * @param title - The conversation title.
   * @returns The newly created Conversation.
   */
  async createConversation(title: string): Promise<Conversation> {
    const [row] = await db
      .insert(conversations)
      .values({ title })
      .returning();
    return row;
  }

  /**
   * Renames a conversation.
   * @param id - The conversation's integer ID.
   * @param title - The new title string.
   * @returns The updated Conversation, or undefined if not found.
   */
  async updateConversationTitle(
    id: number,
    title: string
  ): Promise<Conversation | undefined> {
    const [row] = await db
      .update(conversations)
      .set({ title })
      .where(eq(conversations.id, id))
      .returning();
    return row;
  }

  /**
   * Deletes a conversation. Messages cascade via FK constraint.
   * @param id - The conversation's integer ID.
   */
  async deleteConversation(id: number): Promise<void> {
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  // ─── Message methods ────────────────────────────────────────────────────────

  /**
   * Returns all messages for a conversation sorted oldest-first.
   * @param conversationId - The parent conversation's integer ID.
   * @returns Chronologically ordered array of Message records.
   */
  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
  }

  /**
   * Persists a new message in the given conversation.
   * @param conversationId - The parent conversation's integer ID.
   * @param role - Message author role ("user" or "assistant").
   * @param content - The message text content.
   * @returns The newly created Message.
   */
  async createMessage(
    conversationId: number,
    role: string,
    content: string
  ): Promise<Message> {
    const [row] = await db
      .insert(messages)
      .values({ conversationId, role, content })
      .returning();
    return row;
  }

  // ─── Agent methods ──────────────────────────────────────────────────────────

  /**
   * Returns all prompt agents (default and user-created).
   * @returns Array of all Agent records.
   */
  async getAllAgents(): Promise<Agent[]> {
    const rows = await db.select().from(agentsTable);
    return rows.map(rowToAgent);
  }

  /**
   * Retrieves a prompt agent by its ID.
   * @param id - The agent's ID.
   * @returns The matching Agent, or undefined if not found.
   */
  async getAgent(id: string): Promise<Agent | undefined> {
    const [row] = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.id, id));
    return row ? rowToAgent(row) : undefined;
  }

  /**
   * Creates a new user-defined prompt agent with a generated UUID.
   * @param agent - Agent fields excluding id.
   * @returns The newly created Agent.
   */
  async createAgent(agent: Omit<Agent, "id">): Promise<Agent> {
    const id = randomUUID();
    const [row] = await db
      .insert(agentsTable)
      .values({
        id,
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        icon: agent.icon,
        isDefault: agent.isDefault ?? false,
      })
      .returning();
    return rowToAgent(row);
  }

  /**
   * Applies a partial update to a prompt agent.
   * @param id - The agent's ID.
   * @param updates - Partial Agent fields to merge in.
   * @returns The updated Agent, or undefined if not found.
   */
  async updateAgent(
    id: string,
    updates: Partial<Agent>
  ): Promise<Agent | undefined> {
    const row = await this.getAgent(id);
    if (!row) return undefined;
    const [updated] = await db
      .update(agentsTable)
      .set({
        name: updates.name ?? row.name,
        description: updates.description ?? row.description,
        systemPrompt: updates.systemPrompt ?? row.systemPrompt,
        icon: updates.icon ?? row.icon,
        isDefault: updates.isDefault ?? row.isDefault,
      })
      .where(eq(agentsTable.id, id))
      .returning();
    return rowToAgent(updated);
  }

  /**
   * Deletes a user-created prompt agent. Default agents are protected.
   * @param id - The agent's ID.
   */
  async deleteAgent(id: string): Promise<void> {
    const agent = await this.getAgent(id);
    if (agent && !agent.isDefault) {
      await db.delete(agentsTable).where(eq(agentsTable.id, id));
    }
  }

  // ─── Support Ticket methods ─────────────────────────────────────────────────

  /**
   * Returns all support tickets sorted newest-first.
   * @returns Array of all SupportTicket records.
   */
  async getAllTickets(): Promise<SupportTicket[]> {
    const rows = await db
      .select()
      .from(supportTicketsTable)
      .orderBy(desc(supportTicketsTable.createdAt));
    return rows.map(rowToSupportTicket);
  }

  /**
   * Retrieves a support ticket by its ID.
   * @param id - The ticket's string ID.
   * @returns The matching SupportTicket, or undefined if not found.
   */
  async getTicket(id: string): Promise<SupportTicket | undefined> {
    const [row] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, id));
    return row ? rowToSupportTicket(row) : undefined;
  }

  /**
   * Returns all tickets with a specific status, sorted newest-first.
   * @param status - The ticket status to filter by.
   * @returns Filtered and sorted array of SupportTicket records.
   */
  async getTicketsByStatus(status: TicketStatus): Promise<SupportTicket[]> {
    const rows = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.status, status))
      .orderBy(desc(supportTicketsTable.createdAt));
    return rows.map(rowToSupportTicket);
  }

  /**
   * Returns all tickets assigned to a specific support agent, sorted newest-first.
   * @param agentId - The support agent's ID.
   * @returns Filtered and sorted array of SupportTicket records.
   */
  async getTicketsByAgent(agentId: string): Promise<SupportTicket[]> {
    const rows = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.assignedAgentId, agentId))
      .orderBy(desc(supportTicketsTable.createdAt));
    return rows.map(rowToSupportTicket);
  }

  /**
   * Creates and persists a new support ticket with a computed SLA deadline.
   * SLA windows by priority: urgent = 1 h, high = 4 h, medium = 24 h, low = 72 h.
   * @param ticketData - Fields required to create the ticket.
   * @returns The newly created SupportTicket.
   */
  async createTicket(ticketData: InsertSupportTicket): Promise<SupportTicket> {
    const id = `ticket-${randomUUID()}`;
    const now = new Date();
    const slaHours =
      ticketData.priority === "urgent"
        ? 1
        : ticketData.priority === "high"
        ? 4
        : ticketData.priority === "medium"
        ? 24
        : 72;

    const [row] = await db
      .insert(supportTicketsTable)
      .values({
        id,
        subject: ticketData.subject,
        description: ticketData.description,
        category: ticketData.category ?? "general",
        priority: ticketData.priority ?? "medium",
        status: "open",
        customerId: ticketData.customerId,
        customerEmail: ticketData.customerEmail,
        customerName: ticketData.customerName,
        assignedAgentId: null,
        escalationLevel: 0,
        slaDeadline: new Date(now.getTime() + slaHours * 60 * 60 * 1000),
        tags: [],
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return rowToSupportTicket(row);
  }

  /**
   * Applies a partial update to a support ticket and stamps updatedAt.
   * @param id - The ticket's string ID.
   * @param updates - Partial SupportTicket fields to merge in.
   * @returns The updated SupportTicket, or undefined if not found.
   */
  async updateTicket(
    id: string,
    updates: Partial<SupportTicket>
  ): Promise<SupportTicket | undefined> {
    const existing = await this.getTicket(id);
    if (!existing) return undefined;

    // Build the update payload, omitting undefined values
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.subject !== undefined) patch.subject = updates.subject;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.priority !== undefined) patch.priority = updates.priority;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.assignedAgentId !== undefined) patch.assignedAgentId = updates.assignedAgentId;
    if (updates.aiSuggestedCategory !== undefined) patch.aiSuggestedCategory = updates.aiSuggestedCategory;
    if (updates.aiSuggestedPriority !== undefined) patch.aiSuggestedPriority = updates.aiSuggestedPriority;
    if (updates.aiSummary !== undefined) patch.aiSummary = updates.aiSummary;
    if (updates.aiSuggestedResponse !== undefined) patch.aiSuggestedResponse = updates.aiSuggestedResponse;
    if (updates.escalationReason !== undefined) patch.escalationReason = updates.escalationReason;
    if (updates.escalationLevel !== undefined) patch.escalationLevel = updates.escalationLevel;
    if (updates.slaDeadline !== undefined) patch.slaDeadline = updates.slaDeadline;
    if (updates.firstResponseAt !== undefined) patch.firstResponseAt = updates.firstResponseAt;
    if (updates.resolvedAt !== undefined) patch.resolvedAt = updates.resolvedAt;
    if (updates.tags !== undefined) patch.tags = updates.tags;

    const [row] = await db
      .update(supportTicketsTable)
      .set(patch)
      .where(eq(supportTicketsTable.id, id))
      .returning();
    return rowToSupportTicket(row);
  }

  /**
   * Deletes a support ticket. Messages cascade via FK constraint.
   * @param id - The ticket's string ID.
   */
  async deleteTicket(id: string): Promise<void> {
    await db.delete(supportTicketsTable).where(eq(supportTicketsTable.id, id));
  }

  // ─── Ticket Message methods ─────────────────────────────────────────────────

  /**
   * Returns all messages for a ticket sorted oldest-first.
   * @param ticketId - The parent ticket's string ID.
   * @returns Chronologically ordered array of TicketMessage records.
   */
  async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    const rows = await db
      .select()
      .from(ticketMessagesTable)
      .where(eq(ticketMessagesTable.ticketId, ticketId))
      .orderBy(asc(ticketMessagesTable.createdAt));
    return rows.map(rowToTicketMessage);
  }

  /**
   * Persists a new message on a support ticket thread.
   * @param messageData - Fields required to create the ticket message.
   * @returns The newly created TicketMessage.
   */
  async createTicketMessage(
    messageData: InsertTicketMessage
  ): Promise<TicketMessage> {
    const id = `msg-${randomUUID()}`;
    const [row] = await db
      .insert(ticketMessagesTable)
      .values({
        id,
        ticketId: messageData.ticketId,
        senderId: messageData.senderId,
        senderType: messageData.senderType,
        content: messageData.content,
        isInternal: messageData.isInternal ?? false,
      })
      .returning();
    return rowToTicketMessage(row);
  }

  // ─── Support Agent methods ──────────────────────────────────────────────────

  /**
   * Returns all support agents.
   * @returns Array of all SupportAgent records.
   */
  async getAllSupportAgents(): Promise<SupportAgent[]> {
    const rows = await db.select().from(supportAgentsTable);
    return rows.map(rowToSupportAgent);
  }

  /**
   * Retrieves a support agent by their ID.
   * @param id - The support agent's ID.
   * @returns The matching SupportAgent, or undefined if not found.
   */
  async getSupportAgent(id: string): Promise<SupportAgent | undefined> {
    const [row] = await db
      .select()
      .from(supportAgentsTable)
      .where(eq(supportAgentsTable.id, id));
    return row ? rowToSupportAgent(row) : undefined;
  }

  /**
   * Returns available agents who have the given category skill and capacity,
   * sorted by current workload ratio (least loaded first).
   * @param category - The ticket category to match against agent skills.
   * @returns Filtered and sorted array of available SupportAgent records.
   */
  async getAvailableAgentsForCategory(
    category: TicketCategory
  ): Promise<SupportAgent[]> {
    const rows = await db
      .select()
      .from(supportAgentsTable)
      .where(
        and(
          eq(supportAgentsTable.isAvailable, true),
          eq(supportAgentsTable.isOnline, true)
        )
      );
    return rows
      .map(rowToSupportAgent)
      .filter(
        (a) =>
          a.skills.includes(category) &&
          a.currentTicketCount < a.maxTickets
      )
      .sort(
        (a, b) =>
          a.currentTicketCount / a.maxTickets -
          b.currentTicketCount / b.maxTickets
      );
  }

  /**
   * Creates and persists a new support agent with default metrics.
   * @param agentData - Fields required to create the agent.
   * @returns The newly created SupportAgent.
   */
  async createSupportAgent(agentData: InsertSupportAgent): Promise<SupportAgent> {
    const id = `support-${randomUUID()}`;
    const [row] = await db
      .insert(supportAgentsTable)
      .values({
        id,
        name: agentData.name,
        email: agentData.email,
        skills: agentData.skills,
        maxTickets: agentData.maxTickets ?? 10,
        currentTicketCount: 0,
        isAvailable: true,
        isOnline: true,
        averageResponseTime: 0,
        satisfactionScore: 5.0,
      })
      .returning();
    return rowToSupportAgent(row);
  }

  /**
   * Applies a partial update to a support agent's record.
   * @param id - The support agent's ID.
   * @param updates - Partial SupportAgent fields to merge in.
   * @returns The updated SupportAgent, or undefined if not found.
   */
  async updateSupportAgent(
    id: string,
    updates: Partial<SupportAgent>
  ): Promise<SupportAgent | undefined> {
    const existing = await this.getSupportAgent(id);
    if (!existing) return undefined;

    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.email !== undefined) patch.email = updates.email;
    if (updates.skills !== undefined) patch.skills = updates.skills;
    if (updates.maxTickets !== undefined) patch.maxTickets = updates.maxTickets;
    if (updates.currentTicketCount !== undefined) patch.currentTicketCount = updates.currentTicketCount;
    if (updates.isAvailable !== undefined) patch.isAvailable = updates.isAvailable;
    if (updates.isOnline !== undefined) patch.isOnline = updates.isOnline;
    if (updates.averageResponseTime !== undefined) patch.averageResponseTime = updates.averageResponseTime;
    if (updates.satisfactionScore !== undefined) patch.satisfactionScore = updates.satisfactionScore;

    const [row] = await db
      .update(supportAgentsTable)
      .set(patch)
      .where(eq(supportAgentsTable.id, id))
      .returning();
    return rowToSupportAgent(row);
  }

  /**
   * Deletes a support agent by their ID.
   * @param id - The support agent's ID.
   */
  async deleteSupportAgent(id: string): Promise<void> {
    await db
      .delete(supportAgentsTable)
      .where(eq(supportAgentsTable.id, id));
  }

  // ─── Escalation Rule methods ────────────────────────────────────────────────

  /**
   * Returns all escalation rules regardless of active status.
   * @returns Array of all EscalationRule records.
   */
  async getAllEscalationRules(): Promise<EscalationRule[]> {
    const rows = await db.select().from(escalationRulesTable);
    return rows.map(rowToEscalationRule);
  }

  /**
   * Returns only the escalation rules that are currently active.
   * @returns Array of active EscalationRule records.
   */
  async getActiveEscalationRules(): Promise<EscalationRule[]> {
    const rows = await db
      .select()
      .from(escalationRulesTable)
      .where(eq(escalationRulesTable.isActive, true));
    return rows.map(rowToEscalationRule);
  }
}
