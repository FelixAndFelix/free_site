import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { VOTE_COOLDOWN_MINUTES, type VoteValue } from "@free-site/shared";
import type { Db } from "../database";
import { modules, voteChanges, votes } from "../schema";

export const VOTE_COOLDOWN_MS = VOTE_COOLDOWN_MINUTES * 60 * 1000;

interface VoteChange {
  userId: string;
  moduleId: string;
  /** The new vote, or null to withdraw it. */
  value: VoteValue | null;
  now: Date;
  /** Admin actions (e.g. moving a user to another course) skip the user's cooldown. */
  ignoreCooldown?: boolean;
}

/** Either the change was applied (or was a no-op), or the cooldown blocks it until retryAt. */
export type VoteChangeResult = { ok: true } | { ok: false; retryAt: Date };

/**
 * Returns the time from which a vote last changed at updatedAt may change again, or null if it may now.
 * @param {Date | null | undefined} updatedAt
 * @param {Date} now
 */
export function cooldownEnd(updatedAt: Date | null | undefined, now: Date): Date | null {
  if (!updatedAt) return null;
  const end = new Date(updatedAt.getTime() + VOTE_COOLDOWN_MS);
  return end > now ? end : null;
}

/**
 * Sets, changes or withdraws a user's vote and records the change in the history.
 * Every write to votes goes through here, so the history always matches the current votes.
 * A user may change a module's vote once per cooldown; the first vote is always allowed.
 * @param {Db} db
 * @param {VoteChange} change
 */
export async function changeVote(
  db: Db,
  { userId, moduleId, value, now, ignoreCooldown = false }: VoteChange,
): Promise<VoteChangeResult> {
  return db.transaction(async (transaction) => {
    // Serialises concurrent requests of one user on one module, so no change is recorded twice.
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`${userId}:${moduleId}`}))`);
    const matchesVote = and(eq(votes.userId, userId), eq(votes.moduleId, moduleId));
    const [current] = await transaction
      .select({ value: votes.value, updatedAt: votes.updatedAt })
      .from(votes)
      .where(matchesVote);
    const fromValue = current?.value ?? null;
    // Repeating the current vote changes nothing and does not restart the cooldown.
    if (fromValue === value) return { ok: true };
    const retryAt = cooldownEnd(current?.updatedAt, now);
    if (retryAt && !ignoreCooldown) return { ok: false, retryAt };

    // Withdrawing keeps the row with a null value, so withdraw-then-vote cannot skip the cooldown.
    await transaction
      .insert(votes)
      .values({ userId, moduleId, value, updatedAt: now })
      .onConflictDoUpdate({ target: [votes.userId, votes.moduleId], set: { value, updatedAt: now } });
    await transaction.insert(voteChanges).values({ moduleId, fromValue, toValue: value, changedAt: now });
    return { ok: true };
  });
}

/**
 * Withdraws a user's votes on modules outside the given course (all votes for null),
 * used when an admin moves a user out of a course, so votes only count in the voter's course.
 * @param {Db} db
 * @param {{userId: string, courseId: string | null, now: Date}} options
 */
export async function withdrawVotesOutsideCourse(
  db: Db,
  { userId, courseId, now }: { userId: string; courseId: string | null; now: Date },
): Promise<void> {
  const outsideCourse = courseId
    ? inArray(votes.moduleId, db.select({ id: modules.id }).from(modules).where(ne(modules.courseId, courseId)))
    : undefined;
  const staleVotes = await db
    .select({ moduleId: votes.moduleId })
    .from(votes)
    .where(and(eq(votes.userId, userId), isNotNull(votes.value), outsideCourse));
  for (const { moduleId } of staleVotes) {
    await changeVote(db, { userId, moduleId, value: null, now, ignoreCooldown: true });
  }
}
