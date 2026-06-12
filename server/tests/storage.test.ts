import { describe, it, expect, beforeEach } from "vitest";
import { MemStorage } from "../storage";
import type { InsertUser } from "../../shared/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a minimal InsertUser fixture.
 * @param overrides - Optional fields to override the defaults.
 * @returns A valid InsertUser object.
 */
function makeInsertUser(overrides: Partial<InsertUser> = {}): InsertUser {
  return {
    googleId: "google-123",
    email: "test@example.com",
    name: "Test User",
    avatar: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MemStorage", () => {
  let storage: MemStorage;

  beforeEach(() => {
    // Fresh instance per test — no shared state between cases
    storage = new MemStorage();
  });

  // ─── Users ──────────────────────────────────────────────────────────────────

  describe("Users", () => {
    it("createUser creates a user and returns it with an id", async () => {
      const user = await storage.createUser(makeInsertUser());

      expect(user.id).toBeDefined();
      expect(typeof user.id).toBe("string");
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.googleId).toBe("google-123");
    });

    it("getUserById returns the correct user", async () => {
      const created = await storage.createUser(makeInsertUser());
      const found = await storage.getUser(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.email).toBe(created.email);
    });

    it("getUserById returns undefined for unknown id", async () => {
      const found = await storage.getUser("non-existent-id");

      expect(found).toBeUndefined();
    });

    it("getUserByGoogleId returns the correct user", async () => {
      const created = await storage.createUser(
        makeInsertUser({ googleId: "google-unique-456" })
      );
      const found = await storage.getUserByGoogleId("google-unique-456");

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.googleId).toBe("google-unique-456");
    });
  });

  // ─── Conversations ───────────────────────────────────────────────────────────

  describe("Conversations", () => {
    it("createConversation creates and returns a conversation", async () => {
      const user = await storage.createUser(makeInsertUser());
      const convo = await storage.createConversation("Hello World", user.id);

      expect(convo.id).toBeDefined();
      expect(convo.title).toBe("Hello World");
      expect(convo.userId).toBe(user.id);
      expect(convo.createdAt).toBeInstanceOf(Date);
    });

    it("getConversation returns the correct conversation", async () => {
      const user = await storage.createUser(makeInsertUser());
      const created = await storage.createConversation("My Chat", user.id);
      const found = await storage.getConversation(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe("My Chat");
    });

    it("getAllConversations returns only conversations for that userId", async () => {
      const userA = await storage.createUser(makeInsertUser({ googleId: "g-a", email: "a@test.com" }));
      const userB = await storage.createUser(makeInsertUser({ googleId: "g-b", email: "b@test.com" }));

      await storage.createConversation("A's chat", userA.id);
      await storage.createConversation("B's chat", userB.id);
      await storage.createConversation("A's second chat", userA.id);

      const convosA = await storage.getAllConversations(userA.id);
      const convosB = await storage.getAllConversations(userB.id);

      expect(convosA).toHaveLength(2);
      expect(convosA.every((c) => c.userId === userA.id)).toBe(true);
      expect(convosB).toHaveLength(1);
      expect(convosB[0].userId).toBe(userB.id);
    });

    it("deleteConversation removes it from storage", async () => {
      const user = await storage.createUser(makeInsertUser());
      const convo = await storage.createConversation("To Delete", user.id);

      await storage.deleteConversation(convo.id);

      const found = await storage.getConversation(convo.id);
      expect(found).toBeUndefined();
    });
  });

  // ─── Messages ────────────────────────────────────────────────────────────────

  describe("Messages", () => {
    it("createMessage creates and returns a message", async () => {
      const user = await storage.createUser(makeInsertUser());
      const convo = await storage.createConversation("Chat", user.id);
      const msg = await storage.createMessage(convo.id, "user", "Hello!");

      expect(msg.id).toBeDefined();
      expect(msg.conversationId).toBe(convo.id);
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("Hello!");
      expect(msg.createdAt).toBeInstanceOf(Date);
    });

    it("getMessagesByConversation returns only messages for that conversationId", async () => {
      const user = await storage.createUser(makeInsertUser());
      const convoA = await storage.createConversation("A", user.id);
      const convoB = await storage.createConversation("B", user.id);

      await storage.createMessage(convoA.id, "user", "msg in A");
      await storage.createMessage(convoA.id, "assistant", "reply in A");
      await storage.createMessage(convoB.id, "user", "msg in B");

      const msgsA = await storage.getMessagesByConversation(convoA.id, user.id);
      const msgsB = await storage.getMessagesByConversation(convoB.id, user.id);

      expect(msgsA).toHaveLength(2);
      expect(msgsA.every((m) => m.conversationId === convoA.id)).toBe(true);
      expect(msgsB).toHaveLength(1);
      expect(msgsB[0].content).toBe("msg in B");
    });

    it("getMessagesByConversation throws 403 for unknown conversationId", async () => {
      // MemStorage throws a 403 Forbidden error (not returns empty) when the
      // conversation doesn't exist — unknown IDs are treated as access violations
      // to prevent ID-enumeration attacks.
      const user = await storage.createUser(makeInsertUser());

      await expect(
        storage.getMessagesByConversation(99999, user.id)
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
