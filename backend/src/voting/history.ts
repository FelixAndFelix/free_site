import { asc, eq } from "drizzle-orm";
import { VOTE_VALUES, type VoteCounts, type VoteHistoryDay, type VoteValue } from "@free-site/shared";
import type { Db } from "../database";
import { voteChanges } from "../schema";

const DAY_MS = 24 * 60 * 60 * 1000;
// Days are cut at midnight in Germany, where the students are, not at midnight UTC.
const berlinDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" });

/**
 * Returns the calendar day of an instant in Europe/Berlin as YYYY-MM-DD.
 * @param {Date} instant
 */
export function toBerlinDay(instant: Date): string {
  return berlinDate.format(instant);
}

/**
 * Returns the YYYY-MM-DD day after the given one.
 * @param {string} day
 */
function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

/**
 * Replays the vote changes of a module into the counts at the end of every day, from the day of
 * the first change up to today. Days without changes repeat the previous counts, so the lines stay
 * continuous. Returns no days for a module that was never voted on.
 * @param {Db} db
 * @param {string} moduleId
 * @param {Date} now
 */
export async function loadVoteHistory(db: Db, moduleId: string, now: Date): Promise<VoteHistoryDay[]> {
  const changes = await db
    .select({ fromValue: voteChanges.fromValue, toValue: voteChanges.toValue, changedAt: voteChanges.changedAt })
    .from(voteChanges)
    .where(eq(voteChanges.moduleId, moduleId))
    .orderBy(asc(voteChanges.changedAt));
  if (changes.length === 0) return [];

  const endOfDayCounts = new Map<string, VoteCounts>();
  const counts = Object.fromEntries(VOTE_VALUES.map((value) => [value, 0])) as VoteCounts;
  for (const { fromValue, toValue, changedAt } of changes) {
    applyChange(counts, fromValue, toValue);
    endOfDayCounts.set(toBerlinDay(changedAt), { ...counts });
  }

  const days: VoteHistoryDay[] = [];
  const today = toBerlinDay(now);
  let previous = endOfDayCounts.get(toBerlinDay(changes[0]!.changedAt))!;
  for (let day = toBerlinDay(changes[0]!.changedAt); day <= today; day = nextDay(day)) {
    previous = endOfDayCounts.get(day) ?? previous;
    days.push({ day, counts: previous });
  }
  return days;
}

/**
 * Moves one vote from its old value to its new one in the running counts.
 * @param {VoteCounts} counts
 * @param {VoteValue | null} fromValue
 * @param {VoteValue | null} toValue
 */
function applyChange(counts: VoteCounts, fromValue: VoteValue | null, toValue: VoteValue | null) {
  if (fromValue) counts[fromValue] -= 1;
  if (toValue) counts[toValue] += 1;
}
