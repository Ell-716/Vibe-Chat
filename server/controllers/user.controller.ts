import type { Request, Response } from "express";
import type { User } from "@shared/schema";
import * as userService from "../services/user.service";

/**
 * Handler — returns the current authenticated user from the session.
 * GET /api/user/me
 * @param req - Express request.
 * @param res - Express response.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  res.json(req.user as User);
}

/**
 * Handler — updates the authenticated user's display name.
 * PATCH /api/user/profile
 * Body: { name?: string }
 * @param req - Express request.
 * @param res - Express response.
 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = (req.user as User).id;
  const { name } = req.body as { name?: string };

  if (name === undefined) {
    res.status(400).json({ message: "name is required" });
    return;
  }

  try {
    const updated = await userService.updateUserProfile(userId, name);
    res.json(updated);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json({ message: e.message });
  }
}

/**
 * Handler — updates the authenticated user's preferences.
 * PATCH /api/user/preferences
 * Body: { defaultModel?: string, defaultAgent?: string, appearance?: 'light' | 'dark' | 'system' }
 * @param req - Express request.
 * @param res - Express response.
 */
export async function updatePreferences(req: Request, res: Response): Promise<void> {
  const userId = (req.user as User).id;
  const { defaultModel, defaultAgent, appearance } = req.body as {
    defaultModel?: string;
    defaultAgent?: string;
    appearance?: "light" | "dark" | "system";
  };

  try {
    const updated = await userService.updateUserPreferences(userId, {
      ...(defaultModel !== undefined && { defaultModel }),
      ...(defaultAgent !== undefined && { defaultAgent }),
      ...(appearance !== undefined && { appearance }),
    });
    res.json(updated);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json({ message: e.message });
  }
}

/**
 * Handler — permanently deletes the authenticated user's account and all associated data.
 * Requires { confirm: true } in the request body as an explicit opt-in.
 * Destroys the session after deletion.
 * DELETE /api/user/account
 * Body: { confirm: true }
 * @param req - Express request.
 * @param res - Express response.
 */
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  const { confirm } = req.body as { confirm?: boolean };

  if (confirm !== true) {
    res.status(400).json({ message: "Body must contain { confirm: true } to proceed" });
    return;
  }

  const userId = (req.user as User).id;

  try {
    await userService.deleteUserAccount(userId);

    req.logout((logoutErr) => {
      if (logoutErr) console.error("[user] Logout error during account deletion:", logoutErr);
      req.session.destroy(() => {
        res.json({ success: true });
      });
    });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json({ message: e.message });
  }
}
