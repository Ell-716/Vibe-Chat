import express, { type Express } from "express";
import fs from "fs";
import path from "path";

/**
 * Serves the pre-built client from dist/public in production.
 * Throws if the build directory is missing (i.e. `npm run build` was not run).
 * Falls back to index.html for all unmatched routes so client-side routing works.
 * @param app - The Express application to attach static-file middleware to.
 */
export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
