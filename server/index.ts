import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "./config/passport";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startDiscordBot, destroyDiscordClient } from "./services/discord.service";
import { env } from "./config/env";

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
    console.error(`[discord] Non-fatal WebSocket error: ${msg}`);
    return;
  }
  // Re-throw anything else so genuine bugs still surface.
  throw err;
});

const app = express();
const httpServer = createServer(app);

const MemoryStoreSession = MemoryStore(session);

app.use(
  session({
    secret: env.SESSION_SECRET ?? "dev-fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === "production",
      httpOnly: true,
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
 * Prints a timestamped log line to stdout.
 * @param message - The message to log.
 * @param source - Label shown in brackets after the timestamp (defaults to "express").
 */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
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
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Monkey-patch res.json so we can read the body before it is sent
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
  function shutdown() {
    log("Shutting down...");
    destroyDiscordClient();
    httpServer.close(() => process.exit(0));
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
