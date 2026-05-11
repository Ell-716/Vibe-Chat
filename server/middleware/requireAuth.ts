import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";

// Ensure req.user is typed as our User throughout all controllers
declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

/**
 * Express middleware that enforces authentication on a route.
 * Calls next() when the request has an active session; otherwise
 * returns a 401 JSON response and halts the middleware chain.
 * @param req - Express request.
 * @param res - Express response.
 * @param next - Next middleware function.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    next();
    return;
  }
  res.status(401).json({ message: "Authentication required" });
}
