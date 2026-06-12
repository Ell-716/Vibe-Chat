import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "../middleware/requireAuth";
import type { Request, Response, NextFunction } from "express";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal mock Request with a controllable isAuthenticated() stub.
 * @param authenticated - Whether isAuthenticated() should return true.
 * @returns A partial Request mock.
 */
function makeReq(authenticated: boolean): Partial<Request> {
  return {
    isAuthenticated: vi.fn().mockReturnValue(authenticated),
  };
}

/**
 * Builds a minimal mock Response that records status/json calls.
 * @returns A partial Response mock with chainable status().
 */
function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const res = {
    json: vi.fn(),
    status: vi.fn(),
  };
  // status() must return the same object so .status(401).json(...) chains
  res.status.mockReturnValue(res);
  return res;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("requireAuth middleware", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it("calls next() when the request is authenticated", () => {
    const req = makeReq(true);
    const res = makeRes();

    requireAuth(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("returns 401 JSON when req.isAuthenticated() returns false", () => {
    const req = makeReq(false);
    const res = makeRes();

    requireAuth(req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Authentication required" });
  });

  it("does not call next() when unauthenticated", () => {
    const req = makeReq(false);
    const res = makeRes();

    requireAuth(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 JSON when req.user is undefined (isAuthenticated returns false)", () => {
    // Passport sets isAuthenticated() to false when no session user is present
    const req = makeReq(false);
    (req as any).user = undefined;
    const res = makeRes();

    requireAuth(req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 JSON when req.user is null (isAuthenticated returns false)", () => {
    const req = makeReq(false);
    (req as any).user = null;
    const res = makeRes();

    requireAuth(req as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns the correct error message format", () => {
    const req = makeReq(false);
    const res = makeRes();

    requireAuth(req as Request, res as unknown as Response, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload).toHaveProperty("message");
    expect(typeof payload.message).toBe("string");
    expect(payload.message).toBe("Authentication required");
  });
});
