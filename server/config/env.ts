/**
 * Centralised environment variable access.
 * All process.env reads happen here — the rest of the codebase imports from this module.
 * Optional integrations keep `undefined` values so callers can check presence before use.
 */
export const env = {
  // ── Server ────────────────────────────────────────────────────────────────
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",

  // ── OpenAI (primary chat model + embeddings + support AI) ─────────────────
  OPENAI_API_KEY: process.env.AI_INTEGRATIONS_OPENAI_API_KEY as string | undefined,
  OPENAI_BASE_URL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL as string | undefined,

  // ── Alternative LLM providers ─────────────────────────────────────────────
  GROQ_API_KEY: process.env.GROQ_API_KEY as string | undefined,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY as string | undefined,
  GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY as string | undefined,

  // ── ElevenLabs (TTS / STT) ────────────────────────────────────────────────
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY as string | undefined,

  // ── Zapier MCP (Google Drive / Sheets tool-calling) ───────────────────────
  ZAPIER_MCP_URL: process.env.ZAPIER_MCP_URL as string | undefined,
  ZAPIER_MCP_API_KEY: process.env.ZAPIER_MCP_API_KEY as string | undefined,

  // ── Discord bot ───────────────────────────────────────────────────────────
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN as string | undefined,

  // ── EmailJS (support ticket notifications) ────────────────────────────────
  EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID as string | undefined,
  EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID as string | undefined,
  EMAILJS_PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY as string | undefined,
  EMAILJS_PRIVATE_KEY: process.env.EMAILJS_PRIVATE_KEY as string | undefined,

  // ── Database ──────────────────────────────────────────────────────────────
  DATABASE_URL: process.env.DATABASE_URL as string | undefined,
} as const;
