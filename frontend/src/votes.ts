import type { VoteValue } from "@free-site/shared";

/**
 * Label and CSS color token per vote value. The colors (green, amber, red) were checked with the
 * dataviz palette validator for color-vision deficiencies; amber is below 3:1 against white,
 * so every bar is paired with visible text labels and counts.
 */
export const VOTE_META: Record<VoteValue, { label: string; color: string; tint: string }> = {
  free: { label: "Free", color: "var(--vote-free)", tint: "var(--vote-free-tint)" },
  possible: { label: "Possible", color: "var(--vote-possible)", tint: "var(--vote-possible-tint)" },
  impossible: { label: "Impossible", color: "var(--vote-impossible)", tint: "var(--vote-impossible-tint)" },
};
