import { storage } from "../storage";
import type { User, UserPreferences } from "@shared/schema";

const ALLOWED_MODELS = [
  "openai/gpt-oss-120b",
  "gpt-4o-mini",
  "claude-sonnet-4-6",
  "gemini-1.5-flash",
  "deepseek-v4-flash",
];

const ALLOWED_APPEARANCES = ["light", "dark", "system"] as const;

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultModel: "openai/gpt-oss-120b",
  defaultAgent: "general",
  appearance: "system",
};

/** Loose but practical email format check — rejects obvious non-emails. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Updates the display name and/or email address of a user.
 * At least one field must be supplied. Both fields are validated before any
 * write is attempted; id, googleId, and all other fields are never touched.
 * @param userId - The user's UUID.
 * @param data - Object containing optional `name` (1–50 chars) and/or `email`.
 * @returns The updated User record.
 * @throws Error with statusCode 400 if no fields supplied or any value is invalid.
 * @throws Error with statusCode 404 if user is not found.
 */
export async function updateUserProfile(
  userId: string,
  data: { name?: string; email?: string }
): Promise<User> {
  const updates: Partial<User> = {};

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) {
      throw Object.assign(new Error("Name cannot be empty"), { statusCode: 400 });
    }
    if (trimmed.length > 50) {
      throw Object.assign(new Error("Name must be 50 characters or fewer"), { statusCode: 400 });
    }
    updates.name = trimmed;
  }

  if (data.email !== undefined) {
    if (!EMAIL_REGEX.test(data.email)) {
      throw Object.assign(new Error("Invalid email format"), { statusCode: 400 });
    }
    updates.email = data.email;
  }

  if (Object.keys(updates).length === 0) {
    throw Object.assign(new Error("At least one field (name or email) is required"), { statusCode: 400 });
  }

  const updated = await storage.updateUser(userId, updates);
  if (!updated) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }
  return updated;
}

/**
 * Returns the stored preferences for a user, falling back to defaults.
 * @param userId - The user's UUID.
 * @returns The user's UserPreferences.
 * @throws Error with statusCode 404 if user is not found.
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  return storage.getUserPreferences(userId);
}

/**
 * Merges the supplied fields into the user's preferences and persists them.
 * Each provided field is validated against its allowed values.
 * @param userId - The user's UUID.
 * @param data - Subset of UserPreferences fields to update.
 * @returns The updated UserPreferences.
 * @throws Error with statusCode 400 for any invalid field value.
 */
export async function updateUserPreferences(
  userId: string,
  data: Partial<UserPreferences>
): Promise<UserPreferences> {
  if (data.defaultModel !== undefined && !ALLOWED_MODELS.includes(data.defaultModel)) {
    const err = Object.assign(
      new Error(`Invalid model. Allowed: ${ALLOWED_MODELS.join(", ")}`),
      { statusCode: 400 }
    );
    throw err;
  }

  if (data.appearance !== undefined && !(ALLOWED_APPEARANCES as readonly string[]).includes(data.appearance)) {
    const err = Object.assign(
      new Error("Invalid appearance. Allowed: light, dark, system"),
      { statusCode: 400 }
    );
    throw err;
  }

  return storage.updateUserPreferences(userId, data);
}

/**
 * Permanently deletes all data belonging to a user in dependency order:
 * messages → conversations → documents → user row.
 * @param userId - The user's UUID.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  return storage.deleteUserAccount(userId);
}
