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
