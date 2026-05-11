import type { Request, Response } from "express";
import * as authService from "../services/auth.service";

/**
 * Middleware — initiates the Google OAuth flow.
 * GET /auth/google
 */
export const initiateGoogleAuth = authService.initiateGoogleAuth();

/**
 * Middleware — handles the Google OAuth callback from Google's servers.
 * Chained before googleCallbackSuccess in the route definition.
 * GET /auth/google/callback
 */
export const googleCallback = authService.handleGoogleCallback();

/**
 * Handler — redirects to the app root after a successful OAuth callback.
 * @param _req - Express request (unused).
 * @param res - Express response.
 */
export function googleCallbackSuccess(_req: Request, res: Response): void {
  res.redirect("/");
}

/**
 * Handler — logs the user out and redirects to /login.
 * POST /auth/logout
 * @param req - Express request.
 * @param res - Express response.
 */
export function logout(req: Request, res: Response): void {
  authService.logout(req, res);
}

/**
 * Handler — returns the current authenticated user as JSON.
 * Returns 401 if no session is active.
 * GET /auth/me
 * @param req - Express request.
 * @param res - Express response.
 */
export function getMe(req: Request, res: Response): void {
  const user = authService.getCurrentUser(req);
  if (!user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  res.json(user);
}
