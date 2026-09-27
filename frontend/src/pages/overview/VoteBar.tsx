import { VOTE_VALUES, type VoteCounts } from "@free-site/shared";
import { VOTE_META } from "../../votes";

/**
 * Formats a share of the total as a whole percentage.
 * @param {number} count
 * @param {number} total
 */
function percent(count: number, total: number): string {
  return `${Math.round((count / total) * 100)}%`;
}

/**
 * Stacked bar of the vote shares with a legend of the counts, so identity never relies on color alone.
 * @param {{counts: VoteCounts}} props
 */
export function VoteBar({ counts }: { counts: VoteCounts }) {
  const total = VOTE_VALUES.reduce((sum, value) => sum + counts[value], 0);
  const summary = VOTE_VALUES.map((value) => `${VOTE_META[value].label} ${counts[value]}`).join(", ");

  return (
    <div className="vote-chart">
      <div className="vote-bar" role="img" aria-label={total === 0 ? "No votes yet" : summary}>
        {total === 0 ? (
          <span className="vote-bar-empty" />
        ) : (
          VOTE_VALUES.filter((value) => counts[value] > 0).map((value) => (
            <span
              key={value}
              className="vote-bar-segment"
              style={{ flexGrow: counts[value], background: VOTE_META[value].color }}
              title={`${VOTE_META[value].label}: ${counts[value]} (${percent(counts[value], total)})`}
            />
          ))
        )}
      </div>
      {total === 0 ? (
        <p className="vote-legend muted">No votes yet</p>
      ) : (
        <p className="vote-legend">
          {VOTE_VALUES.map((value) => (
            <span key={value} className="vote-legend-item">
              <span className="swatch" style={{ background: VOTE_META[value].color }} aria-hidden="true" />
              {VOTE_META[value].label} {counts[value]}
            </span>
          ))}
          <span className="muted">{total === 1 ? "1 vote" : `${total} votes`}</span>
        </p>
      )}
    </div>
  );
}
