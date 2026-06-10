import "dotenv/config";
import * as Sentry from "@sentry/node";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "./config/passport";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startDiscordBot, destroyDiscordClient } from "./services/discord.service";
import { env } from "./config/env";
import { logger } from "./lib/logger";

// Initialise Sentry as early as possible so it can instrument all subsequent
// middleware and route handlers. `enabled` is false when SENTRY_DSN is unset,
// so local/CI environments without a DSN run without any Sentry overhead.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  // Disable Sentry entirely when no DSN is configured (e.g. local dev).
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

// Last-resort guard: Discord.js's underlying `ws` library emits low-level
// WebSocket errors (e.g. "Opening handshake has timed out") directly on the
// ws instance before Discord.js can attach its own handler, so they escape
// Events.Error and arrive here as uncaught exceptions.  Log and continue —
// Discord will reconnect on its own schedule.
process.on("uncaughtException", (err) => {
  const msg = err.message ?? "";
  if (
    msg.includes("Opening handshake has timed out") ||
    msg.includes("WebSocket was closed before the connection was established")
  ) {
    logger.error({ msg }, "[discord] Non-fatal WebSocket error");
    return;
  }
  // Re-throw anything else so genuine bugs still surface.
  throw err;
});

const app = express();
const httpServer = createServer(app);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "https:"],
        "media-src": ["'self'", "blob:"],
      },
    },
  })
);

app.use(cors({
  origin: env.APP_URL ?? "http://localhost:5000",
  credentials: true,
}));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

app.use(globalLimiter);

const MemoryStoreSession = MemoryStore(session);

app.use(
  session({
    secret: env.SESSION_SECRET ?? "dev-fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    store: new MemoryStoreSession({
      checkPeriod: 86_400_000, // prune expired sessions every 24 h
    }),
  })
);

app.use(passport.initialize());
app.use(passport.session());

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

/**
 * Logs an info-level message with an optional source label.
 * @param message - The message to log.
 * @param source - Label shown in the log record (defaults to "express").
 */
export function log(message: string, source = "express") {
  logger.info({ source }, message);
}

/**
 * Request-logging middleware.
 * Intercepts res.json to capture the response body, then logs method, path,
 * status code, duration, and a JSON snippet for every /api request once the
 * response has finished.
 */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logger.info({
        method: req.method,
        path,
        status: res.statusCode,
        duration: `${duration}ms`,
      });
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  
  startDiscordBot().then((connected) => {
    if (connected) {
      log('Discord bot started successfully', 'discord');
    } else {
      log('Discord bot not started (token not configured or login failed)', 'discord');
    }
  });

  // Must be registered after all routes so Sentry captures errors from every handler.
  Sentry.setupExpressErrorHandler(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error(err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown so Ctrl+C (SIGINT) and SIGTERM work cleanly.
  // Without this, Discord.js keeps the Node event loop alive indefinitely.
  // The 1.5 s hard-exit guard handles Vite HMR keep-alive connections that
  // would otherwise prevent httpServer.close() from ever completing.
  let isShuttingDown = false;
  function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log("Shutting down...");
    destroyDiscordClient();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
