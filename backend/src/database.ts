import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

/**
 * Creates the Postgres connection pool with a health check.
 * @param {string} connectionString
 */
export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
  const db = drizzle(pool);

  /** Resolves true if Postgres answers a trivial query, never throws. */
  async function check(): Promise<boolean> {
    try {
      await db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }

  return { db, check, close: () => pool.end() };
}
