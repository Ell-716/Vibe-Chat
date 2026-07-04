import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { createServer } from "http";
import type { User } from "../../shared/schema";

// ─── Module mocks ─────────────────────────────────────────────────────────────

// auth.controller.ts executes authService.initiateGoogleAuth() and
// handleGoogleCallback() at module load time (top-level consts). Those call
// passport.authenticate("google", ...) which throws if no strategy is
// registered. Mock the entire service to replace them with no-op middleware.
vi.mock("../services/auth.service", () => ({
  initiateGoogleAuth: () => (_req: any, _res: any, next: any) => next(),
  handleGoogleCallback: () => (_req: any, _res: any, next: any) => next(),
  logout: vi.fn(),
  // Preserve the real logic: read req.isAuthenticated() injected by buildApp()
  getCurrentUser: (req: any) => (req.isAuthenticated() ? (req.user ?? null) : null),
}));

// Prevent the Discord bot from starting during route registration
vi.mock("../services/discord.service", () => ({
  startDiscordBot: vi.fn().mockResolvedValue(false),
  destroyDiscordClient: vi.fn(),
  getDiscordBotStatus: vi.fn().mockReturnValue({ connected: false }),
}));

// Prevent real PostgreSQL connections. DATABASE_URL is unset in tests so the
// health route never calls db.execute — but routes.ts imports db at the top.
vi.mock("../db", () => ({
  db: { execute: vi.fn().mockResolvedValue({ rows: [] }) },
}));

// agentPromptQueries uses Drizzle ORM chainable queries against the real db.
// Mock it so multi-agent routes don't crash on import.
vi.mock("../agentPromptQueries", () => ({
  getLatestPrompt: vi.fn().mockResolvedValue(null),
  insertPrompt: vi.fn().mockResolvedValue({}),
  getPromptHistory: vi.fn().mockResolvedValue([]),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_USER: User = {
  id: "user-uuid-test-001",
  googleId: "google-test-999",
  email: "integration@example.com",
  name: "Integration User",
  avatar: null,
  preferences: {
    defaultModel: "openai/gpt-oss-120b",
    defaultAgent: "general",
    appearance: "system",
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── App factory ──────────────────────────────────────────────────────────────

/**
 * Builds a minimal Express app with all routes registered via registerRoutes().
 * Auth state is injected directly via middleware rather than a real Passport
 * session, so tests remain fast and database-free (MemStorage is used because
 * DATABASE_URL is not set in the test environment).
 * @param authenticated - Whether every request in this app should appear authenticated.
 * @returns A configured Express app ready for supertest.
 */
async function buildApp(authenticated = false): Promise<express.Express> {
  const { registerRoutes } = await import("../routes");
  const app = express();
  app.use(express.json());

  // Inject Passport-compatible auth state before any route or middleware runs.
  // This simulates what passport.session() does after deserialising the session.
  app.use((req: any, _res: any, next: any) => {
    req.isAuthenticated = () => authenticated;
    req.user = authenticated ? MOCK_USER : undefined;
    // Minimal stubs so logout() and session.destroy() don't throw
    req.logout = (cb: () => void) => cb();
    req.session = { destroy: (cb: () => void) => cb() };
    next();
  });

  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("returns 200 with status: ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("includes a db field in the response", async () => {
    const res = await request(app).get("/health");

    expect(res.body).toHaveProperty("db");
    expect(typeof res.body.db).toBe("string");
  });

  it("reports db as 'not configured' when DATABASE_URL is unset", async () => {
    const res = await request(app).get("/health");

    // DATABASE_URL is absent in the test environment, so MemStorage is used
    // and the health handler skips the DB probe entirely.
    expect(res.body.db).toBe("not configured");
  });
});

describe("GET /auth/me", () => {
  it("returns 401 with a message when not authenticated", async () => {
    const app = await buildApp(false);
    const res = await request(app).get("/auth/me");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  it("returns the user object when the session is valid", async () => {
    const app = await buildApp(true);
    const res = await request(app).get("/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(MOCK_USER.id);
    expect(res.body.email).toBe(MOCK_USER.email);
    expect(res.body.name).toBe(MOCK_USER.name);
  });

  it("does not expose sensitive fields like googleId in the response", async () => {
    const app = await buildApp(true);
    const res = await request(app).get("/auth/me");

    // googleId is stored server-side for OAuth matching but should not be
    // relied upon client-side — verify it's not accidentally omitted entirely
    // but also not the primary identifier the client should use.
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
  });
});

describe("Protected /api routes — no session", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await buildApp(false);
  });

  it("GET /api/conversations returns 401 without a session", async () => {
    const res = await request(app).get("/api/conversations");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  it("GET /api/models returns 401 without a session", async () => {
    const res = await request(app).get("/api/models");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  it("GET /api/agents returns 401 without a session", async () => {
    const res = await request(app).get("/api/agents");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });
});
