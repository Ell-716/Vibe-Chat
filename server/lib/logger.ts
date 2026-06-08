import pino from "pino";

/**
 * Shared pino logger instance.
 * Log level defaults to "info" in production and "debug" in development,
 * overridable via the LOG_LEVEL environment variable.
 * In non-production environments, output is piped through pino-pretty
 * for human-readable colourised logs.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: { colorize: true },
        }
      : undefined,
});
