import { Client, GatewayIntentBits, Message, Events } from 'discord.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const conversationHistory: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map();

const MAX_HISTORY = 10;

async function generateAIResponse(userId: string, userMessage: string): Promise<string> {
  try {
    let history = conversationHistory.get(userId) || [];
    
    history.push({ role: 'user', content: userMessage });
    
    if (history.length > MAX_HISTORY * 2) {
      history = history.slice(-MAX_HISTORY * 2);
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are Vibe Chat, a helpful AI assistant on Discord. Be friendly, concise, and helpful. Use Discord-appropriate formatting (bold with **, code with `, etc). Keep responses under 2000 characters to fit Discord limits.',
        },
        ...history,
      ],
      max_tokens: 1000,
    });

    const assistantMessage = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    
    history.push({ role: 'assistant', content: assistantMessage });
    conversationHistory.set(userId, history);

    return assistantMessage;
  } catch (error) {
    console.error('Discord AI error:', error);
    return 'Sorry, I encountered an error processing your message. Please try again.';
  }
}

async function handleMessage(message: Message) {
  if (message.author.bot) return;
  
  const isMentioned = message.mentions.has(client.user!);
  const isDM = !message.guild;
  
  if (!isMentioned && !isDM) return;
  
  let content = message.content;
  if (isMentioned && client.user) {
    content = content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  }
  
  if (!content) {
    await message.reply('Hi! How can I help you? Just mention me with your question.');
    return;
  }

  try {
    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }
    
    const response = await generateAIResponse(message.author.id, content);
    
    if (response.length > 2000) {
      const chunks: string[] = [];
      let remaining = response;
      while (remaining.length > 0) {
        if (remaining.length <= 1990) {
          chunks.push(remaining);
          break;
        }
        let splitIndex = remaining.lastIndexOf('\n', 1990);
        if (splitIndex === -1 || splitIndex < 500) {
          splitIndex = remaining.lastIndexOf(' ', 1990);
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
    console.error('Discord message handling error:', error);
    await message.reply('Sorry, something went wrong. Please try again.');
  }
}

export async function startDiscordBot(): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  
  if (!token) {
    console.log('Discord bot token not configured - skipping Discord integration');
    return false;
  }

  return new Promise((resolve) => {
    client.once(Events.ClientReady, (readyClient) => {
      console.log(`Discord bot connected as ${readyClient.user.tag}`);
      console.log(`Bot is in ${readyClient.guilds.cache.size} servers`);
      resolve(true);
    });

    client.on(Events.MessageCreate, handleMessage);

    client.on(Events.Error, (error) => {
      console.error('Discord client error:', error);
    });

    client.login(token).catch((error) => {
      console.error('Failed to login to Discord:', error.message);
      resolve(false);
    });
  });
}

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
