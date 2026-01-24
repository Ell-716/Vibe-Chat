import { 
  type User, type InsertUser, type Conversation, type InsertConversation, 
  type Message, type InsertMessage, type Agent, defaultAgents,
  type SupportTicket, type TicketMessage, type SupportAgent, type EscalationRule,
  type InsertSupportTicket, type InsertTicketMessage, type InsertSupportAgent,
  type TicketPriority, type TicketStatus, type TicketCategory,
  defaultSupportAgents, defaultEscalationRules
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
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

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

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
      createdAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversationTitle(id: number, title: string): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    conversation.title = title;
    this.conversations.set(id, conversation);
    return conversation;
  }

  async deleteConversation(id: number): Promise<void> {
    this.conversations.delete(id);
    for (const [msgId, msg] of this.messages) {
      if (msg.conversationId === id) {
        this.messages.delete(msgId);
      }
    }
  }

  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((msg) => msg.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

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

  async getAllAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async createAgent(agent: Omit<Agent, 'id'>): Promise<Agent> {
    const id = randomUUID();
    const newAgent: Agent = { ...agent, id };
    this.agents.set(id, newAgent);
    return newAgent;
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    const updatedAgent = { ...agent, ...updates, id };
    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }

  async deleteAgent(id: string): Promise<void> {
    // Don't allow deleting default agents
    const agent = this.agents.get(id);
    if (agent && !agent.isDefault) {
      this.agents.delete(id);
    }
  }

  // Support Ticket methods
  async getAllTickets(): Promise<SupportTicket[]> {
    return Array.from(this.tickets.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getTicket(id: string): Promise<SupportTicket | undefined> {
    return this.tickets.get(id);
  }

  async getTicketsByStatus(status: TicketStatus): Promise<SupportTicket[]> {
    return Array.from(this.tickets.values())
      .filter((ticket) => ticket.status === status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getTicketsByAgent(agentId: string): Promise<SupportTicket[]> {
    return Array.from(this.tickets.values())
      .filter((ticket) => ticket.assignedAgentId === agentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createTicket(ticketData: InsertSupportTicket): Promise<SupportTicket> {
    const id = `ticket-${randomUUID()}`;
    const now = new Date();
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
    return ticket;
  }

  async updateTicket(id: string, updates: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;
    const updatedTicket = { ...ticket, ...updates, id, updatedAt: new Date() };
    this.tickets.set(id, updatedTicket);
    return updatedTicket;
  }

  async deleteTicket(id: string): Promise<void> {
    this.tickets.delete(id);
    // Also delete associated messages
    for (const [msgId, msg] of this.ticketMessages) {
      if (msg.ticketId === id) {
        this.ticketMessages.delete(msgId);
      }
    }
  }

  // Ticket Message methods
  async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    return Array.from(this.ticketMessages.values())
      .filter((msg) => msg.ticketId === ticketId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

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

  // Support Agent methods
  async getAllSupportAgents(): Promise<SupportAgent[]> {
    return Array.from(this.supportAgents.values());
  }

  async getSupportAgent(id: string): Promise<SupportAgent | undefined> {
    return this.supportAgents.get(id);
  }

  async getAvailableAgentsForCategory(category: TicketCategory): Promise<SupportAgent[]> {
    return Array.from(this.supportAgents.values())
      .filter((agent) => 
        agent.isAvailable && 
        agent.isOnline && 
        agent.skills.includes(category) &&
        agent.currentTicketCount < agent.maxTickets
      )
      .sort((a, b) => {
        // Sort by workload (current tickets / max tickets ratio)
        const workloadA = a.currentTicketCount / a.maxTickets;
        const workloadB = b.currentTicketCount / b.maxTickets;
        return workloadA - workloadB;
      });
  }

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

  async updateSupportAgent(id: string, updates: Partial<SupportAgent>): Promise<SupportAgent | undefined> {
    const agent = this.supportAgents.get(id);
    if (!agent) return undefined;
    const updatedAgent = { ...agent, ...updates, id };
    this.supportAgents.set(id, updatedAgent);
    return updatedAgent;
  }

  async deleteSupportAgent(id: string): Promise<void> {
    this.supportAgents.delete(id);
  }

  // Escalation Rule methods
  async getAllEscalationRules(): Promise<EscalationRule[]> {
    return Array.from(this.escalationRules.values());
  }

  async getActiveEscalationRules(): Promise<EscalationRule[]> {
    return Array.from(this.escalationRules.values()).filter((rule) => rule.isActive);
  }
}

export const storage = new MemStorage();
