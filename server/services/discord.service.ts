import { Client, GatewayIntentBits, type Message, Events } from "discord.js";
import OpenAI from "openai";
import { env } from "../config/env";

let _groq: OpenAI | null = null;
/** Returns the Groq client (OpenAI-compatible) for Discord AI responses, throwing if the key is absent. */
function getGroq(): OpenAI {
  if (!_groq) {
    if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is required for Discord AI responses");
    _groq = new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1", timeout: 30_000 });
  }
  return _groq;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Register error handler immediately so WebSocket timeout/handshake errors
// don't become unhandled 'error' events that crash the process.
client.on(Events.Error, (error) => {
  console.error("Discord client error:", error.message);
});

/** Per-user conversation history kept in memory for the duration of the process. */
const conversationHistory: Map<string, Array<{ role: "user" | "assistant"; content: string }>> = new Map();

/** Rolling window of message pairs kept per user. */
const MAX_HISTORY = 10;

/** Maximum number of distinct users tracked in memory. When exceeded, the oldest
 *  entry (by insertion order) is evicted to prevent unbounded growth. */
const MAX_HISTORY_USERS = 100;

/**
 * Generates an AI response for a Discord user using GPT-4o-mini.
 * Maintains a per-user rolling window of the last MAX_HISTORY exchanges.
 * @param userId - Discord user ID used as the history key.
 * @param userMessage - The user's message text.
 * @returns The assistant's reply text.
 */
async function generateAIResponse(userId: string, userMessage: string): Promise<string> {
  try {
    let history = conversationHistory.get(userId) || [];

    history.push({ role: "user", content: userMessage });

    // Trim history to rolling window to avoid unbounded growth
    if (history.length > MAX_HISTORY * 2) {
      history = history.slice(-MAX_HISTORY * 2);
    }

    const response = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are Vibe Chat, a helpful AI assistant on Discord. Be friendly, concise, and helpful. Use Discord-appropriate formatting (bold with **, code with `, etc). Keep responses under 2000 characters to fit Discord limits.",
        },
        ...history,
      ],
      max_tokens: 1000,
    });

    const assistantMessage =
      response.choices[0]?.message?.content || "Sorry, I could not generate a response.";

    history.push({ role: "assistant", content: assistantMessage });

    // Evict the oldest user entry if the Map has grown beyond the user cap
    if (!conversationHistory.has(userId) && conversationHistory.size >= MAX_HISTORY_USERS) {
      const oldestKey = conversationHistory.keys().next().value;
      if (oldestKey !== undefined) conversationHistory.delete(oldestKey);
    }
    conversationHistory.set(userId, history);

    return assistantMessage;
  } catch (error) {
    console.error("Discord AI error:", error);
    return "Sorry, I encountered an error processing your message. Please try again.";
  }
}

/**
 * Handles an incoming Discord message event.
 * Only responds to DMs or messages that @mention the bot.
 * Splits responses that exceed Discord's 2000-character limit.
 * @param message - The Discord message object from the gateway event.
 */
async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot) return;

  const isMentioned = message.mentions.has(client.user!);
  const isDM = !message.guild;

  if (!isMentioned && !isDM) return;

  // Strip the bot mention from the message content
  let content = message.content;
  if (isMentioned && client.user) {
    content = content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
  }

  if (!content) {
    await message.reply("Hi! How can I help you? Just mention me with your question.");
    return;
  }

  try {
    if ("sendTyping" in message.channel) {
      await message.channel.sendTyping();
    }

    const response = await generateAIResponse(message.author.id, content);

    if (response.length > 2000) {
      // Split on paragraph breaks first, then word boundaries
      const chunks: string[] = [];
      let remaining = response;
      while (remaining.length > 0) {
        if (remaining.length <= 1990) {
          chunks.push(remaining);
          break;
        }
        let splitIndex = remaining.lastIndexOf("\n", 1990);
        if (splitIndex === -1 || splitIndex < 500) {
          splitIndex = remaining.lastIndexOf(" ", 1990);
        }
        if (splitIndex === -1 || splitIndex < 500) {
          splitIndex = 1990;
        }
        chunks.push(remaining.slice(0, splitIndex));
        remaining = remaining.slice(splitIndex).trimStart();
      }
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(response);
    }
  } catch (error) {
    console.error("Discord message handling error:", error);
    await message.reply("Sorry, something went wrong. Please try again.");
  }
}

/**
 * Logs the bot into Discord and registers event handlers.
 * Returns false (without throwing) when the token is absent or login fails,
 * preserving graceful degradation for environments without Discord configured.
 * @returns True if the bot connected successfully, false otherwise.
 */
export async function startDiscordBot(): Promise<boolean> {
  const token = env.DISCORD_BOT_TOKEN;

  if (!token) {
    console.log("Discord bot token not configured - skipping Discord integration");
    return false;
  }

  return new Promise((resolve) => {
    client.once(Events.ClientReady, (readyClient) => {
      console.log(`Discord bot connected as ${readyClient.user.tag}`);
      console.log(`Bot is in ${readyClient.guilds.cache.size} servers`);
      resolve(true);
    });

    // Wrap in an arrow function so the returned Promise is caught — Discord.js
    // does not await event handler return values, so unhandled rejections would
    // otherwise crash the process in Node.js 15+.
    client.on(Events.MessageCreate, (message) => {
      handleMessage(message).catch((err) =>
        console.error("Unhandled Discord message error:", err)
      );
    });

    client.login(token).catch((error) => {
      console.error("Failed to login to Discord:", error.message);
      resolve(false);
    });
  });
}

/**
 * Returns the current connection status of the Discord bot.
 * @returns An object with connected flag and, if connected, username and server count.
 */
export function getDiscordBotStatus(): { connected: boolean; username?: string; servers?: number } {
  if (!client.user) {
    return { connected: false };
  }
  return {
    connected: true,
    username: client.user.tag,
    servers: client.guilds.cache.size,
  };
}
