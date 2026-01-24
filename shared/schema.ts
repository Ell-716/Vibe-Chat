import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export interface MCPTool {
  id: string;
  name: string;
  type: 'drive' | 'sheets';
  fileName?: string;
  fileId?: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  icon: string;
  isDefault?: boolean;
}

export const defaultAgents: Agent[] = [
  {
    id: "general",
    name: "General Assistant",
    description: "A helpful AI assistant for everyday tasks",
    systemPrompt: "You are a helpful, friendly AI assistant. Answer questions clearly and concisely. Be conversational and helpful.",
    icon: "bot",
    isDefault: true,
  },
  {
    id: "coder",
    name: "Code Expert",
    description: "Specialized in programming and software development",
    systemPrompt: "You are an expert software developer and programming tutor. Help with coding questions, debug issues, explain concepts, and write clean, efficient code. Always provide code examples when relevant. Use markdown code blocks with proper syntax highlighting.",
    icon: "code",
  },
  {
    id: "writer",
    name: "Creative Writer",
    description: "Expert at creative writing and content creation",
    systemPrompt: "You are a creative writing expert. Help with storytelling, poetry, copywriting, and content creation. Be imaginative, expressive, and help users craft compelling narratives. Offer suggestions to improve tone, style, and engagement.",
    icon: "pen-tool",
  },
  {
    id: "analyst",
    name: "Data Analyst",
    description: "Expert at analyzing data and providing insights",
    systemPrompt: "You are a data analysis expert. Help users understand data, create analyses, explain statistics, and derive insights. Be precise with numbers and explain complex concepts in simple terms. When working with data, always clarify assumptions.",
    icon: "bar-chart",
  },
  {
    id: "tutor",
    name: "Learning Tutor",
    description: "Patient teacher for learning new topics",
    systemPrompt: "You are a patient and encouraging tutor. Help users learn new topics by breaking down complex concepts, asking guiding questions, and providing examples. Adapt your explanations to the user's level of understanding. Celebrate progress and encourage curiosity.",
    icon: "graduation-cap",
  },
];

export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "pending_customer" | "escalated" | "resolved" | "closed";
export type TicketCategory = "billing" | "technical" | "account" | "feature_request" | "bug_report" | "general";

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  customerId: string;
  customerEmail: string;
  customerName: string;
  assignedAgentId: string | null;
  aiSuggestedCategory: TicketCategory | null;
  aiSuggestedPriority: TicketPriority | null;
  aiSummary: string | null;
  aiSuggestedResponse: string | null;
  escalationReason: string | null;
  escalationLevel: number;
  slaDeadline: Date | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: "customer" | "agent" | "system";
  content: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface SupportAgent {
  id: string;
  name: string;
  email: string;
  skills: TicketCategory[];
  maxTickets: number;
  currentTicketCount: number;
  isAvailable: boolean;
  isOnline: boolean;
  averageResponseTime: number;
  satisfactionScore: number;
  createdAt: Date;
}

export interface EscalationRule {
  id: string;
  name: string;
  priority: TicketPriority;
  category: TicketCategory | null;
  triggerAfterMinutes: number;
  escalateToLevel: number;
  notifyManagement: boolean;
  isActive: boolean;
}

export interface InsertSupportTicket {
  subject: string;
  description: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  category?: TicketCategory;
  priority?: TicketPriority;
}

export interface InsertTicketMessage {
  ticketId: string;
  senderId: string;
  senderType: "customer" | "agent" | "system";
  content: string;
  isInternal?: boolean;
}

export interface InsertSupportAgent {
  name: string;
  email: string;
  skills: TicketCategory[];
  maxTickets?: number;
}

export const defaultSupportAgents: SupportAgent[] = [
  {
    id: "agent-1",
    name: "Sarah Johnson",
    email: "sarah@support.com",
    skills: ["billing", "account", "general"],
    maxTickets: 10,
    currentTicketCount: 3,
    isAvailable: true,
    isOnline: true,
    averageResponseTime: 15,
    satisfactionScore: 4.8,
    createdAt: new Date(),
  },
  {
    id: "agent-2",
    name: "Mike Chen",
    email: "mike@support.com",
    skills: ["technical", "bug_report", "feature_request"],
    maxTickets: 8,
    currentTicketCount: 5,
    isAvailable: true,
    isOnline: true,
    averageResponseTime: 20,
    satisfactionScore: 4.6,
    createdAt: new Date(),
  },
  {
    id: "agent-3",
    name: "Emily Davis",
    email: "emily@support.com",
    skills: ["billing", "technical", "account"],
    maxTickets: 12,
    currentTicketCount: 8,
    isAvailable: true,
    isOnline: false,
    averageResponseTime: 12,
    satisfactionScore: 4.9,
    createdAt: new Date(),
  },
];

export const defaultEscalationRules: EscalationRule[] = [
  {
    id: "rule-1",
    name: "Urgent tickets auto-escalate",
    priority: "urgent",
    category: null,
    triggerAfterMinutes: 15,
    escalateToLevel: 2,
    notifyManagement: true,
    isActive: true,
  },
  {
    id: "rule-2",
    name: "High priority billing issues",
    priority: "high",
    category: "billing",
    triggerAfterMinutes: 30,
    escalateToLevel: 1,
    notifyManagement: false,
    isActive: true,
  },
  {
    id: "rule-3",
    name: "Unresponded technical tickets",
    priority: "medium",
    category: "technical",
    triggerAfterMinutes: 60,
    escalateToLevel: 1,
    notifyManagement: false,
    isActive: true,
  },
];
