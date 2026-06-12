import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "../../shared/schema";

// Mock the storage module before importing the service so the service's
// `storage` singleton is replaced before any service code runs.
vi.mock("../storage", () => ({
  storage: {
    updateUser: vi.fn(),
    updateUserPreferences: vi.fn(),
    getUserPreferences: vi.fn(),
    deleteUserAccount: vi.fn(),
  },
}));

// Import after vi.mock so the service picks up the mocked storage.
import { updateUserProfile } from "../services/user.service";
import { storage } from "../storage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a minimal User fixture that storage.updateUser can resolve with.
 * @param overrides - Optional fields to override the defaults.
 * @returns A full User object suitable for mock resolution.
 */
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-uuid-123",
    googleId: "google-456",
    email: "test@example.com",
    name: "Test User",
    avatar: null,
    preferences: { defaultModel: "llama-3.3-70b-versatile", defaultAgent: "general", appearance: "system" },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── updateUserProfile ────────────────────────────────────────────────────────

describe("updateUserProfile", () => {
  const mockUpdateUser = vi.mocked(storage.updateUser);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Valid name updates ────────────────────────────────────────────────────

  it("accepts a valid name update and returns the updated user", async () => {
    const updated = makeUser({ name: "Alice" });
    mockUpdateUser.mockResolvedValue(updated);

    const result = await updateUserProfile("user-uuid-123", { name: "Alice" });

    expect(mockUpdateUser).toHaveBeenCalledWith("user-uuid-123", { name: "Alice" });
    expect(result.name).toBe("Alice");
  });

  it("trims surrounding whitespace from name before saving", async () => {
    const updated = makeUser({ name: "Alice" });
    mockUpdateUser.mockResolvedValue(updated);

    await updateUserProfile("user-uuid-123", { name: "  Alice  " });

    // Only the trimmed value reaches storage — never the raw padded string
    expect(mockUpdateUser).toHaveBeenCalledWith("user-uuid-123", { name: "Alice" });
  });

  it("accepts a name exactly at the 50-character limit", async () => {
    const fiftyChars = "A".repeat(50);
    mockUpdateUser.mockResolvedValue(makeUser({ name: fiftyChars }));

    const result = await updateUserProfile("user-uuid-123", { name: fiftyChars });

    expect(result.name).toBe(fiftyChars);
  });

  // ─── Valid email updates ───────────────────────────────────────────────────

  it("accepts a valid email update and returns the updated user", async () => {
    const updated = makeUser({ email: "new@example.com" });
    mockUpdateUser.mockResolvedValue(updated);

    const result = await updateUserProfile("user-uuid-123", { email: "new@example.com" });

    expect(mockUpdateUser).toHaveBeenCalledWith("user-uuid-123", { email: "new@example.com" });
    expect(result.email).toBe("new@example.com");
  });

  it("accepts updating both name and email in a single call", async () => {
    const updated = makeUser({ name: "Alice", email: "alice@example.com" });
    mockUpdateUser.mockResolvedValue(updated);

    const result = await updateUserProfile("user-uuid-123", {
      name: "Alice",
      email: "alice@example.com",
    });

    expect(mockUpdateUser).toHaveBeenCalledWith("user-uuid-123", {
      name: "Alice",
      email: "alice@example.com",
    });
    expect(result.name).toBe("Alice");
    expect(result.email).toBe("alice@example.com");
  });

  // ─── Name validation errors ────────────────────────────────────────────────

  it("rejects a name longer than 50 characters", async () => {
    await expect(
      updateUserProfile("user-uuid-123", { name: "A".repeat(51) })
    ).rejects.toMatchObject({ statusCode: 400, message: /50 characters/i });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects an empty name string", async () => {
    await expect(
      updateUserProfile("user-uuid-123", { name: "" })
    ).rejects.toMatchObject({ statusCode: 400, message: /empty/i });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only name (treated as empty after trim)", async () => {
    await expect(
      updateUserProfile("user-uuid-123", { name: "   " })
    ).rejects.toMatchObject({ statusCode: 400, message: /empty/i });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  // ─── Email validation errors ───────────────────────────────────────────────

  it("rejects an email missing the @ symbol", async () => {
    await expect(
      updateUserProfile("user-uuid-123", { email: "notanemail" })
    ).rejects.toMatchObject({ statusCode: 400, message: /invalid email/i });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects an email missing a domain", async () => {
    await expect(
      updateUserProfile("user-uuid-123", { email: "user@" })
    ).rejects.toMatchObject({ statusCode: 400, message: /invalid email/i });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects an email with spaces", async () => {
    await expect(
      updateUserProfile("user-uuid-123", { email: "user @example.com" })
    ).rejects.toMatchObject({ statusCode: 400, message: /invalid email/i });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  // ─── No-op / missing fields ────────────────────────────────────────────────

  it("rejects a call with neither name nor email supplied", async () => {
    await expect(
      updateUserProfile("user-uuid-123", {})
    ).rejects.toMatchObject({ statusCode: 400, message: /required/i });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("throws 404 when the user is not found in storage", async () => {
    mockUpdateUser.mockResolvedValue(undefined);

    await expect(
      updateUserProfile("non-existent-id", { name: "Alice" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // ─── Field protection ──────────────────────────────────────────────────────

  it("does not allow updating id or googleId — only name/email are accepted", async () => {
    // updateUserProfile({ name?, email? }) has no parameter for id or googleId.
    // TypeScript enforces this at compile time; this test documents the contract.
    const updated = makeUser({ name: "New Name" });
    mockUpdateUser.mockResolvedValue(updated);

    const result = await updateUserProfile("user-uuid-123", { name: "New Name" });

    // id and googleId on the returned user are unchanged
    expect(result.id).toBe("user-uuid-123");
    expect(result.googleId).toBe("google-456");
    // storage.updateUser is called with only { name } — no id or googleId in the patch
    expect(mockUpdateUser).toHaveBeenCalledWith("user-uuid-123", { name: "New Name" });
  });

  it("does not expose a way to set sensitive fields like preferences or avatar", async () => {
    // NOTE: the User schema has no isAdmin field. The only writable fields
    // through this function are name and email. preferences and avatar require
    // separate service calls (updateUserPreferences / direct storage).
    const updated = makeUser({ name: "New Name" });
    mockUpdateUser.mockResolvedValue(updated);

    await updateUserProfile("user-uuid-123", { name: "New Name" });

    // Only updateUser is called — no other storage write methods are touched
    expect(mockUpdateUser).toHaveBeenCalledOnce();
    expect(vi.mocked(storage.updateUserPreferences)).not.toHaveBeenCalled();
    expect(vi.mocked(storage.deleteUserAccount)).not.toHaveBeenCalled();
  });
});
