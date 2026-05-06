import {
  type User, type InsertUser, type Conversation, type InsertConversation,
  type Message, type InsertMessage, type Agent, defaultAgents,
  type SupportTicket, type TicketMessage, type SupportAgent, type EscalationRule,
  type InsertSupportTicket, type InsertTicketMessage, type InsertSupportAgent,
  type TicketPriority, type TicketStatus, type TicketCategory,
  defaultSupportAgents, defaultEscalationRules
} from "@shared/schema";
import { randomUUID } from "crypto";
import { env } from "./config/env";
import { DatabaseStorage } from "./storage.db";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getConversation(id: number): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string): Promise<Conversation>;
  updateConversationTitle(id: number, title: string): Promise<Conversation | undefined>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<Message>;
  getAllAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  createAgent(agent: Omit<Agent, 'id'>): Promise<Agent>;
  updateAgent(id: string, agent: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: string): Promise<void>;
  
  // Support Ticket methods
  getAllTickets(): Promise<SupportTicket[]>;
  getTicket(id: string): Promise<SupportTicket | undefined>;
  getTicketsByStatus(status: TicketStatus): Promise<SupportTicket[]>;
  getTicketsByAgent(agentId: string): Promise<SupportTicket[]>;
  createTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  updateTicket(id: string, updates: Partial<SupportTicket>): Promise<SupportTicket | undefined>;
  deleteTicket(id: string): Promise<void>;
  
  // Ticket Message methods
  getTicketMessages(ticketId: string): Promise<TicketMessage[]>;
  createTicketMessage(message: InsertTicketMessage): Promise<TicketMessage>;
  
  // Support Agent methods
  getAllSupportAgents(): Promise<SupportAgent[]>;
  getSupportAgent(id: string): Promise<SupportAgent | undefined>;
  getAvailableAgentsForCategory(category: TicketCategory): Promise<SupportAgent[]>;
  createSupportAgent(agent: InsertSupportAgent): Promise<SupportAgent>;
  updateSupportAgent(id: string, updates: Partial<SupportAgent>): Promise<SupportAgent | undefined>;
  deleteSupportAgent(id: string): Promise<void>;
  
  // Escalation Rule methods
  getAllEscalationRules(): Promise<EscalationRule[]>;
  getActiveEscalationRules(): Promise<EscalationRule[]>;
}

/** Maximum number of conversations retained in memory (oldest pruned on overflow). */
const MAX_CONVERSATIONS = 100;

/** Maximum number of support tickets retained in memory. When exceeded, the oldest
 *  resolved or closed ticket is pruned first; active tickets are never evicted. */
const MAX_TICKETS = 500;

/**
 * In-memory implementation of IStorage backed by plain Maps.
 * All data is process-scoped and ephemeral — it is lost on server restart.
 * Bounded growth is enforced via MAX_CONVERSATIONS and MAX_TICKETS caps.
 * Swap this out for a DB-backed implementation to get persistence.
 */
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private agents: Map<string, Agent>;
  private tickets: Map<string, SupportTicket>;
  private ticketMessages: Map<string, TicketMessage>;
  private supportAgents: Map<string, SupportAgent>;
  private escalationRules: Map<string, EscalationRule>;
  private conversationIdCounter: number;
  private messageIdCounter: number;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.agents = new Map();
    this.tickets = new Map();
    this.ticketMessages = new Map();
    this.supportAgents = new Map();
    this.escalationRules = new Map();
    this.conversationIdCounter = 1;
    this.messageIdCounter = 1;
    
    // Initialize with default agents
    for (const agent of defaultAgents) {
      this.agents.set(agent.id, agent);
    }
    
    // Initialize with default support agents
    for (const agent of defaultSupportAgents) {
      this.supportAgents.set(agent.id, agent);
    }
    
    // Initialize with default escalation rules
    for (const rule of defaultEscalationRules) {
      this.escalationRules.set(rule.id, rule);
    }
  }

  /**
   * Retrieves a user by their UUID.
   * @param id - The user's UUID.
   * @returns The matching User, or undefined if not found.
   */
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  /**
   * Retrieves a user by their Google OAuth ID.
   * @param googleId - The Google account ID string.
   * @returns The matching User, or undefined if not found.
   */
  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.googleId === googleId);
  }

  /**
   * Retrieves a user by their email address.
   * @param email - The email address to look up.
   * @returns The matching User, or undefined if not found.
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.email === email);
  }

  /**
   * Creates and persists a new user with a generated UUID.
   * @param insertUser - User fields (googleId, email, name, avatar).
   * @returns The newly created User including its generated id and timestamps.
   */
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = {
      ...insertUser,
      id,
      avatar: insertUser.avatar ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  /**
   * Applies a partial update to a user record and stamps updatedAt.
   * @param id - The user's UUID.
   * @param data - Partial User fields to merge in.
   * @returns The updated User, or undefined if not found.
   */
  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated: User = { ...user, ...data, id, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  /**
   * Retrieves a conversation by its numeric ID.
   * @param id - The conversation's integer ID.
   * @returns The matching Conversation, or undefined if not found.
   */
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  /**
   * Returns all conversations sorted newest-first.
   * @returns Array of all Conversation records.
   */
  async getAllConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createConversation(title: string): Promise<Conversation> {
    const id = this.conversationIdCounter++;
    const conversation: Conversation = {
      id,
      title,
      userId: null,
      createdAt: new Date(),
    };
    this.conversations.set(id, conversation);

    // Prune oldest conversation (and its messages) when the cap is exceeded
    if (this.conversations.size > MAX_CONVERSATIONS) {
      const oldest = Array.from(this.conversations.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      if (oldest) await this.deleteConversation(oldest.id);
    }

    return conversation;
  }

  /**
   * Renames a conversation.
   * @param id - The conversation's integer ID.
   * @param title - The new title string.
   * @returns The updated Conversation, or undefined if not found.
   */
  async updateConversationTitle(id: number, title: string): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    conversation.title = title;
    this.conversations.set(id, conversation);
    return conversation;
  }

  /**
   * Deletes a conversation and all of its associated messages.
   * @param id - The conversation's integer ID.
   */
  async deleteConversation(id: number): Promise<void> {
    this.conversations.delete(id);
    for (const [msgId, msg] of this.messages) {
      if (msg.conversationId === id) {
        this.messages.delete(msgId);
      }
    }
  }

  /**
   * Returns all messages for a conversation sorted oldest-first.
   * @param conversationId - The parent conversation's integer ID.
   * @returns Chronologically ordered array of Message records.
   */
  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((msg) => msg.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Persists a new message in the given conversation.
   * @param conversationId - The parent conversation's integer ID.
   * @param role - Message author role ("user" or "assistant").
   * @param content - The message text content.
   * @returns The newly created Message including its auto-incremented id.
   */
  async createMessage(conversationId: number, role: string, content: string): Promise<Message> {
    const id = this.messageIdCounter++;
    const message: Message = {
      id,
      conversationId,
      role,
      content,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  /**
   * Returns all prompt agents (default and user-created).
   * @returns Array of all Agent records.
   */
  async getAllAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  /**
   * Retrieves a prompt agent by its UUID.
   * @param id - The agent's UUID.
   * @returns The matching Agent, or undefined if not found.
   */
  async getAgent(id: string): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  /**
   * Creates a new user-defined prompt agent with a generated UUID.
   * @param agent - Agent fields excluding id.
   * @returns The newly created Agent including its generated id.
   */
  async createAgent(agent: Omit<Agent, 'id'>): Promise<Agent> {
    const id = randomUUID();
    const newAgent: Agent = { ...agent, id };
    this.agents.set(id, newAgent);
    return newAgent;
  }

  /**
   * Applies a partial update to a prompt agent.
   * @param id - The agent's UUID.
   * @param updates - Partial Agent fields to merge in.
   * @returns The updated Agent, or undefined if not found.
   */
  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    const updatedAgent = { ...agent, ...updates, id };
    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }

  /**
   * Deletes a user-created prompt agent. Default agents are protected and ignored.
   * @param id - The agent's UUID.
   */
  async deleteAgent(id: string): Promise<void> {
    // Default agents are read-only; skip silently if the caller tries to delete one
    const agent = this.agents.get(id);
    if (agent && !agent.isDefault) {
      this.agents.delete(id);
    }
  }

  // ─── Support Ticket methods ───────────────────────────────────────────────────

  /**
   * Returns all support tickets sorted newest-first.
   * @returns Array of all SupportTicket records.
   */
  async getAllTickets(): Promise<SupportTicket[]> {
    return Array.from(this.tickets.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Retrieves a support ticket by its string ID.
   * @param id - The ticket's string ID (e.g. "ticket-<uuid>").
   * @returns The matching SupportTicket, or undefined if not found.
   */
  async getTicket(id: string): Promise<SupportTicket | undefined> {
    return this.tickets.get(id);
  }

  /**
   * Returns all tickets with a specific status, sorted newest-first.
   * @param status - The ticket status to filter by.
   * @returns Filtered and sorted array of SupportTicket records.
   */
  async getTicketsByStatus(status: TicketStatus): Promise<SupportTicket[]> {
    return Array.from(this.tickets.values())
      .filter((ticket) => ticket.status === status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Returns all tickets assigned to a specific support agent, sorted newest-first.
   * @param agentId - The support agent's string ID.
   * @returns Filtered and sorted array of SupportTicket records.
   */
  async getTicketsByAgent(agentId: string): Promise<SupportTicket[]> {
    return Array.from(this.tickets.values())
      .filter((ticket) => ticket.assignedAgentId === agentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Creates and persists a new support ticket with a generated ID and computed SLA deadline.
   * SLA windows by priority: urgent = 1 h, high = 4 h, medium = 24 h, low = 72 h.
   * If the total ticket count exceeds MAX_TICKETS the oldest resolved/closed ticket is pruned.
   * @param ticketData - Fields required to create the ticket.
   * @returns The newly created SupportTicket.
   */
  async createTicket(ticketData: InsertSupportTicket): Promise<SupportTicket> {
    const id = `ticket-${randomUUID()}`;
    const now = new Date();
    // SLA deadline windows in hours, keyed by priority level
    const slaHours = ticketData.priority === 'urgent' ? 1 :
                     ticketData.priority === 'high' ? 4 :
                     ticketData.priority === 'medium' ? 24 : 72;
    
    const ticket: SupportTicket = {
      id,
      subject: ticketData.subject,
      description: ticketData.description,
      category: ticketData.category || 'general',
      priority: ticketData.priority || 'medium',
      status: 'open',
      customerId: ticketData.customerId,
      customerEmail: ticketData.customerEmail,
      customerName: ticketData.customerName,
      assignedAgentId: null,
      aiSuggestedCategory: null,
      aiSuggestedPriority: null,
      aiSummary: null,
      aiSuggestedResponse: null,
      escalationReason: null,
      escalationLevel: 0,
      slaDeadline: new Date(now.getTime() + slaHours * 60 * 60 * 1000),
      firstResponseAt: null,
      resolvedAt: null,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    this.tickets.set(id, ticket);

    // Prune oldest resolved/closed ticket (and its messages) when the cap is exceeded.
    // Active tickets are never evicted.
    if (this.tickets.size > MAX_TICKETS) {
      const closedTickets = Array.from(this.tickets.values())
        .filter((t) => t.status === "resolved" || t.status === "closed")
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (closedTickets[0]) await this.deleteTicket(closedTickets[0].id);
    }

    return ticket;
  }

  /**
   * Applies a partial update to a support ticket and stamps updatedAt.
   * @param id - The ticket's string ID.
   * @param updates - Partial SupportTicket fields to merge in.
   * @returns The updated SupportTicket, or undefined if not found.
   */
  async updateTicket(id: string, updates: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;
    const updatedTicket = { ...ticket, ...updates, id, updatedAt: new Date() };
    this.tickets.set(id, updatedTicket);
    return updatedTicket;
  }

  /**
   * Deletes a support ticket and all of its associated messages.
   * @param id - The ticket's string ID.
   */
  async deleteTicket(id: string): Promise<void> {
    this.tickets.delete(id);
    // Cascade-delete all messages belonging to this ticket
    for (const [msgId, msg] of this.ticketMessages) {
      if (msg.ticketId === id) {
        this.ticketMessages.delete(msgId);
      }
    }
  }

  // ─── Ticket Message methods ───────────────────────────────────────────────────

  /**
   * Returns all messages for a ticket sorted oldest-first.
   * @param ticketId - The parent ticket's string ID.
   * @returns Chronologically ordered array of TicketMessage records.
   */
  async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    return Array.from(this.ticketMessages.values())
      .filter((msg) => msg.ticketId === ticketId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Persists a new message on a support ticket thread.
   * @param messageData - Fields required to create the ticket message.
   * @returns The newly created TicketMessage including its generated id.
   */
  async createTicketMessage(messageData: InsertTicketMessage): Promise<TicketMessage> {
    const id = `msg-${randomUUID()}`;
    const message: TicketMessage = {
      id,
      ticketId: messageData.ticketId,
      senderId: messageData.senderId,
      senderType: messageData.senderType,
      content: messageData.content,
      isInternal: messageData.isInternal || false,
      createdAt: new Date(),
    };
    this.ticketMessages.set(id, message);
    return message;
  }

  // ─── Support Agent methods ────────────────────────────────────────────────────

  /**
   * Returns all support agents.
   * @returns Array of all SupportAgent records.
   */
  async getAllSupportAgents(): Promise<SupportAgent[]> {
    return Array.from(this.supportAgents.values());
  }

  /**
   * Retrieves a support agent by their string ID.
   * @param id - The support agent's string ID (e.g. "support-<uuid>").
   * @returns The matching SupportAgent, or undefined if not found.
   */
  async getSupportAgent(id: string): Promise<SupportAgent | undefined> {
    return this.supportAgents.get(id);
  }

  /**
   * Returns available agents who have the given category skill and capacity,
   * sorted by current workload ratio (least loaded first).
   * @param category - The ticket category to match against agent skills.
   * @returns Filtered and sorted array of available SupportAgent records.
   */
  async getAvailableAgentsForCategory(category: TicketCategory): Promise<SupportAgent[]> {
    return Array.from(this.supportAgents.values())
      .filter((agent) =>
        agent.isAvailable &&
        agent.isOnline &&
        agent.skills.includes(category) &&
        agent.currentTicketCount < agent.maxTickets
      )
      .sort((a, b) => {
        // Sort ascending by workload ratio so the least-loaded agent is first
        const workloadA = a.currentTicketCount / a.maxTickets;
        const workloadB = b.currentTicketCount / b.maxTickets;
        return workloadA - workloadB;
      });
  }

  /**
   * Creates and persists a new support agent with a generated ID and default metrics.
   * @param agentData - Fields required to create the agent.
   * @returns The newly created SupportAgent.
   */
  async createSupportAgent(agentData: InsertSupportAgent): Promise<SupportAgent> {
    const id = `support-${randomUUID()}`;
    const agent: SupportAgent = {
      id,
      name: agentData.name,
      email: agentData.email,
      skills: agentData.skills,
      maxTickets: agentData.maxTickets || 10,
      currentTicketCount: 0,
      isAvailable: true,
      isOnline: true,
      averageResponseTime: 0,
      satisfactionScore: 5.0,
      createdAt: new Date(),
    };
    this.supportAgents.set(id, agent);
    return agent;
  }

  /**
   * Applies a partial update to a support agent's record.
   * @param id - The support agent's string ID.
   * @param updates - Partial SupportAgent fields to merge in.
   * @returns The updated SupportAgent, or undefined if not found.
   */
  async updateSupportAgent(id: string, updates: Partial<SupportAgent>): Promise<SupportAgent | undefined> {
    const agent = this.supportAgents.get(id);
    if (!agent) return undefined;
    const updatedAgent = { ...agent, ...updates, id };
    this.supportAgents.set(id, updatedAgent);
    return updatedAgent;
  }

  /**
   * Deletes a support agent by their string ID.
   * @param id - The support agent's string ID.
   */
  async deleteSupportAgent(id: string): Promise<void> {
    this.supportAgents.delete(id);
  }

  // ─── Escalation Rule methods ──────────────────────────────────────────────────

  /**
   * Returns all escalation rules regardless of active status.
   * @returns Array of all EscalationRule records.
   */
  async getAllEscalationRules(): Promise<EscalationRule[]> {
    return Array.from(this.escalationRules.values());
  }

  /**
   * Returns only the escalation rules that are currently active.
   * @returns Array of active EscalationRule records.
   */
  async getActiveEscalationRules(): Promise<EscalationRule[]> {
    return Array.from(this.escalationRules.values()).filter((rule) => rule.isActive);
  }
}

/**
 * Active storage instance.
 * Uses DatabaseStorage when DATABASE_URL is configured; falls back to
 * MemStorage for local development without a database.
 */
export const storage: IStorage = env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemStorage();
