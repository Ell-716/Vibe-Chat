import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, real, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  googleId: true,
  email: true,
  name: true,
  avatar: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
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

// ─── Drizzle table definitions for persistent entities ────────────────────────

export const agents = pgTable("agents", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  icon: text("icon").notNull(),
  isDefault: boolean("is_default").default(false),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  chunkCount: integer("chunk_count").notNull().default(0),
  totalPages: integer("total_pages").notNull().default(0),
});

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  customerId: varchar("customer_id").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  assignedAgentId: varchar("assigned_agent_id"),
  aiSuggestedCategory: text("ai_suggested_category"),
  aiSuggestedPriority: text("ai_suggested_priority"),
  aiSummary: text("ai_summary"),
  aiSuggestedResponse: text("ai_suggested_response"),
  escalationReason: text("escalation_reason"),
  escalationLevel: integer("escalation_level").notNull().default(0),
  slaDeadline: timestamp("sla_deadline"),
  firstResponseAt: timestamp("first_response_at"),
  resolvedAt: timestamp("resolved_at"),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const ticketMessages = pgTable("ticket_messages", {
  id: varchar("id").primaryKey(),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull(),
  senderType: text("sender_type").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const supportAgents = pgTable("support_agents", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  skills: jsonb("skills").notNull().default(sql`'[]'::jsonb`),
  maxTickets: integer("max_tickets").notNull().default(10),
  currentTicketCount: integer("current_ticket_count").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  isOnline: boolean("is_online").notNull().default(false),
  averageResponseTime: real("average_response_time").notNull().default(0),
  satisfactionScore: real("satisfaction_score").notNull().default(5.0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const escalationRules = pgTable("escalation_rules", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  priority: text("priority").notNull(),
  category: text("category"),
  triggerAfterMinutes: integer("trigger_after_minutes").notNull(),
  escalateToLevel: integer("escalate_to_level").notNull(),
  notifyManagement: boolean("notify_management").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
});

// ─── Drizzle relations ────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  documents: many(documents),
}));

export const conversationsRelations = relations(conversations, ({ one }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));
