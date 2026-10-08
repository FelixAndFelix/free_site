import { and, eq, gt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { AuthUser } from "@free-site/shared";
import type { Db } from "../database";
import { sessions, users } from "../schema";

export const SESSION_COOKIE = "session";
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Derives the stored session id from the cookie token.
 * @param {string} token
 */
function sessionId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Starts a session for a user and returns the opaque cookie token.
 * @param {Db} db
 * @param {string} userId
 * @param {Date} now
 */
export async function createSession(db: Db, userId: string, now: Date): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: sessionId(token),
    userId,
    expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
  });
  return token;
}

/**
 * Returns the user of a valid, unexpired session token, or null.
 * @param {Db} db
 * @param {string} token
 * @param {Date} now
 */
export async function findSessionUser(db: Db, token: string, now: Date): Promise<AuthUser | null> {
  const [user] = await db
    .select({ id: users.id, email: users.email, username: users.username, role: users.role, language: users.language })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId(token)), gt(sessions.expiresAt, now)));
  return user ?? null;
}

/**
 * Ends the session belonging to a token.
 * @param {Db} db
 * @param {string} token
 */
export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId(token)));
}

/**
 * Ends every session of a user (used after a password reset).
 * @param {Db} db
 * @param {string} userId
 */
export async function deleteUserSessions(db: Db, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
