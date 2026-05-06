import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "./config/env";
import * as schema from "@shared/schema";

/**
 * PostgreSQL connection pool using the DATABASE_URL from environment config.
 * The pool is only created when DATABASE_URL is set; callers should guard
 * against undefined before importing this module.
 */
const pool = new Pool({ connectionString: env.DATABASE_URL });

/**
 * Drizzle ORM client bound to the shared schema.
 * Import and use `db` for all database queries in DatabaseStorage.
 */
export const db = drizzle(pool, { schema });
