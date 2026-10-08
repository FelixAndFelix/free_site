import pg from "pg";
import { DATABASE_URL } from "./playwright.config";

/**
 * Starts every run from a clean slate: no users, so the setup code works again, and no courses or
 * modules besides the one the backend creates at boot. Runs after the backend has started, so the
 * tables exist (the backend applies the migrations).
 */
export default async function globalSetup() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("truncate users, email_codes, vote_changes, modules cascade");
    await client.query("delete from courses where join_code <> 'E2E-COURSE-CODE'");
  } finally {
    await client.end();
  }
}
