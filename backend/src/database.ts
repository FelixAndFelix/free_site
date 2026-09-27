import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import * as schema from "./schema";

// Resolves to backend/drizzle from both src/ (dev, tests) and dist/ (production build).
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Creates the Postgres connection pool with a health check and migrations.
 * @param {string} connectionString
 */
export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
  const db = drizzle(pool, { schema });

  /** Resolves true if Postgres answers a trivial query, never throws. */
  async function check(): Promise<boolean> {
    try {
      await db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }

  /** Applies all pending SQL migrations from backend/drizzle. */
  async function runMigrations(): Promise<void> {
    await migrate(db, { migrationsFolder });
  }

  return { db, check, runMigrations, close: () => pool.end() };
}

export type Db = ReturnType<typeof createDatabase>["db"];

const UNIQUE_VIOLATION = "23505";

/**
 * True if the error is Postgres' unique constraint violation (possibly wrapped by Drizzle).
 * @param {unknown} error
 */
export function isUniqueViolation(error: unknown): boolean {
  const { code, cause } = error as { code?: string; cause?: { code?: string } };
  return code === UNIQUE_VIOLATION || cause?.code === UNIQUE_VIOLATION;
}
