import passport from "passport";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";

/**
 * Returns Express middleware that initiates the Google OAuth flow.
 * Requests the "profile" and "email" scopes from Google.
 * @returns Passport authenticate middleware.
 */
export function initiateGoogleAuth() {
  return passport.authenticate("google", { scope: ["profile", "email"] });
}

/**
 * Returns Express middleware that handles the Google OAuth callback.
 * Redirects to /login on failure.
 * @returns Passport authenticate middleware.
 */
export function handleGoogleCallback() {
  return passport.authenticate("google", { failureRedirect: "/login" });
}

/**
 * Logs the user out by calling passport's logout, destroying the session,
 * then redirecting to /login.
 * @param req - Express request.
 * @param res - Express response.
 */
export function logout(req: Request, res: Response): void {
  req.logout((err) => {
    if (err) console.error("[auth] Logout error:", err);
    req.session.destroy(() => {
      res.redirect("/login");
    });
  });
}

/**
 * Returns the currently authenticated user from the request, or null.
 * @param req - Express request.
 * @returns The authenticated User, or null if not signed in.
 */
export function getCurrentUser(req: Request): User | null {
  return req.isAuthenticated() ? (req.user as User) : null;
}
