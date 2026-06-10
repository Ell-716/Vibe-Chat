import { storage } from "../storage";
import type { User, UserPreferences } from "@shared/schema";

const ALLOWED_MODELS = [
  "llama-3.3-70b-versatile",
  "gpt-4o-mini",
  "claude-sonnet-4-6",
  "gemini-1.5-flash",
  "deepseek-v4-flash",
];

const ALLOWED_APPEARANCES = ["light", "dark", "system"] as const;

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultModel: "llama-3.3-70b-versatile",
  defaultAgent: "general",
  appearance: "system",
};

/**
 * Updates the display name of a user.
 * @param userId - The user's UUID.
 * @param name - The new display name (1–50 characters).
 * @returns The updated User record.
 * @throws Error with statusCode 400 if name is empty or too long.
 * @throws Error with statusCode 404 if user is not found.
 */
export async function updateUserProfile(userId: string, name: string): Promise<User> {
  const trimmed = name.trim();
  if (!trimmed) {
    const err = Object.assign(new Error("Name cannot be empty"), { statusCode: 400 });
    throw err;
  }
  if (trimmed.length > 50) {
    const err = Object.assign(new Error("Name must be 50 characters or fewer"), { statusCode: 400 });
    throw err;
  }

  const updated = await storage.updateUserName(userId, trimmed);
  if (!updated) {
    const err = Object.assign(new Error("User not found"), { statusCode: 404 });
    throw err;
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
