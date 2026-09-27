import { and, eq, isNotNull, lt, ne } from "drizzle-orm";
import type { Db } from "../database";
import { courseMembers, emailCodes, sessions, users, votes } from "../schema";
import { changeVote } from "../voting/votes";

/**
 * Deletes a user and everything linked to them (sessions, course membership, votes).
 * The votes are first withdrawn through changeVote(), so the anonymous history records their
 * removal and the graphs keep matching the totals. Returns the id of the user's former course,
 * so live viewers of that course can be told, or null.
 * @param {Db} db
 * @param {{userId: string, now: Date}} options
 */
export async function deleteAccount(db: Db, { userId, now }: { userId: string; now: Date }): Promise<string | null> {
  const [membership] = await db
    .select({ courseId: courseMembers.courseId })
    .from(courseMembers)
    .where(eq(courseMembers.userId, userId));
  const activeVotes = await db
    .select({ moduleId: votes.moduleId })
    .from(votes)
    .where(and(eq(votes.userId, userId), isNotNull(votes.value)));
  for (const { moduleId } of activeVotes) {
    await changeVote(db, { userId, moduleId, value: null, now, ignoreCooldown: true });
  }
  // ON DELETE CASCADE removes sessions, course membership and the (now withdrawn) vote rows.
  await db.delete(users).where(eq(users.id, userId));
  return membership?.courseId ?? null;
}

/**
 * True if the user is an admin and no other admin exists, so deleting them would leave none.
 * @param {Db} db
 * @param {string} userId
 */
export async function isLastAdmin(db: Db, userId: string): Promise<boolean> {
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (user?.role !== "admin") return false;
  const [otherAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), ne(users.id, userId)))
    .limit(1);
  return otherAdmin === undefined;
}

/**
 * Deletes expired email codes and sessions. They are already rejected when used; this removes
 * them from the database, so data is not kept longer than the privacy page says.
 * @param {Db} db
 * @param {Date} now
 */
export async function deleteExpiredRecords(db: Db, now: Date): Promise<{ emailCodes: number; sessions: number }> {
  const deletedCodes = await db.delete(emailCodes).where(lt(emailCodes.expiresAt, now)).returning();
  const deletedSessions = await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning();
  return { emailCodes: deletedCodes.length, sessions: deletedSessions.length };
}
