import { VOTE_VALUES, type VoteCounts, type VoteValue } from "@free-site/shared";
import type { MessageKey } from "./i18n";

/**
 * Label and CSS color token per vote value. The colors (green, amber, red) were checked with the
 * dataviz palette validator for color-vision deficiencies, in light and dark mode (see DESIGN.md);
 * amber is below 3:1 against white, so every bar is paired with visible text labels and counts.
 */
export const VOTE_META: Record<VoteValue, { labelKey: MessageKey; color: string; tint: string }> = {
  free: { labelKey: "vote.free", color: "var(--vote-free)", tint: "var(--vote-free-tint)" },
  possible: { labelKey: "vote.possible", color: "var(--vote-possible)", tint: "var(--vote-possible-tint)" },
  impossible: { labelKey: "vote.impossible", color: "var(--vote-impossible)", tint: "var(--vote-impossible-tint)" },
};

// From this share on, the leading opinion reads as "mostly"; below it only as "leaning".
const MOSTLY_SHARE = 0.6;

export interface Verdict {
  /** The leading vote value, or null when two values share the lead. */
  value: VoteValue | null;
  /** Share of all votes held by the leading value, from 0 to 1. */
  share: number;
  /** Message key of the short summary, e.g. "Mostly free", "Leaning impossible" or "Split". */
  labelKey: MessageKey;
}

/**
 * Sums the votes of all values.
 * @param {VoteCounts} counts
 */
export function totalVotes(counts: VoteCounts): number {
  return VOTE_VALUES.reduce((sum, value) => sum + counts[value], 0);
}

/**
 * Sums up a module's votes in one phrase, so the overview answers "is this exam free?" at a glance.
 * Returns null when nobody has voted yet.
 * @param {VoteCounts} counts
 */
export function verdictOf(counts: VoteCounts): Verdict | null {
  const total = totalVotes(counts);
  if (total === 0) return null;
  const highest = Math.max(...VOTE_VALUES.map((value) => counts[value]));
  const leaders = VOTE_VALUES.filter((value) => counts[value] === highest);
  const share = highest / total;
  if (leaders.length > 1) return { value: null, share, labelKey: "verdict.split" };
  const value = leaders[0]!;
  const strength = share >= MOSTLY_SHARE ? "mostly" : "leaning";
  return { value, share, labelKey: `verdict.${strength}.${value}` };
}

/**
 * Formats a share from 0 to 1 as a whole percentage, e.g. "57%".
 * @param {number} share
 */
export function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}
