import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { VoteValue } from "@free-site/shared";
import type { Db } from "../database";
import { modules, voteChanges, votes } from "../schema";

interface VoteChange {
  userId: string;
  moduleId: string;
  /** The new vote, or null to withdraw it. */
  value: VoteValue | null;
  now: Date;
}

/**
 * Sets, changes or withdraws a user's vote and records the change in the history.
 * Every write to votes goes through here, so the history always matches the current votes.
 * @param {Db} db
 * @param {VoteChange} change
 */
export async function changeVote(db: Db, { userId, moduleId, value, now }: VoteChange): Promise<void> {
  await db.transaction(async (transaction) => {
    // Serialises concurrent requests of one user on one module, so no change is recorded twice.
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`${userId}:${moduleId}`}))`);
    const matchesVote = and(eq(votes.userId, userId), eq(votes.moduleId, moduleId));
    const [current] = await transaction.select({ value: votes.value }).from(votes).where(matchesVote);
    const fromValue = current?.value ?? null;
    if (fromValue === value) return;

    if (value === null) {
      await transaction.delete(votes).where(matchesVote);
    } else {
      await transaction
        .insert(votes)
        .values({ userId, moduleId, value, updatedAt: now })
        .onConflictDoUpdate({ target: [votes.userId, votes.moduleId], set: { value, updatedAt: now } });
    }
    await transaction.insert(voteChanges).values({ moduleId, fromValue, toValue: value, changedAt: now });
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
    .where(and(eq(votes.userId, userId), outsideCourse));
  for (const { moduleId } of staleVotes) await changeVote(db, { userId, moduleId, value: null, now });
}
