import { VOTE_VALUES, type VoteCounts } from "@free-site/shared";
import { VOTE_META, formatShare, totalVotes, verdictOf } from "../../votes";

interface VoteBarProps {
  counts: VoteCounts;
  /** "large" for the module page, where the verdict is the page's headline figure. */
  size?: "normal" | "large";
}

/**
 * The course's opinion on a module: a verdict line ("Mostly free 62%"), a stacked bar of the shares
 * and a legend with the counts, so identity never relies on color alone.
 * @param {VoteBarProps} props
 */
export function VoteBar({ counts, size = "normal" }: VoteBarProps) {
  const total = totalVotes(counts);
  const verdict = verdictOf(counts);
  const summary = VOTE_VALUES.map((value) => `${VOTE_META[value].label} ${counts[value]}`).join(", ");

  return (
    <div className={`vote-chart vote-chart-${size}`}>
      <p className="verdict">
        <span className="verdict-name">
          <span
            className="verdict-mark"
            style={{ background: verdict?.value ? VOTE_META[verdict.value].color : undefined }}
            aria-hidden="true"
          />
          {verdict ? verdict.label : "No votes yet"}
        </span>
        {verdict && <span className="verdict-share">{formatShare(verdict.share)}</span>}
      </p>
      <div className="vote-bar-group">
        <div className="vote-bar" role="img" aria-label={total === 0 ? "No votes yet" : summary}>
          {total === 0 ? (
            <span className="vote-bar-empty" />
          ) : (
            VOTE_VALUES.filter((value) => counts[value] > 0).map((value) => (
              <span
                key={value}
                className="vote-bar-segment"
                style={{ flexGrow: counts[value], background: VOTE_META[value].color }}
                title={`${VOTE_META[value].label}: ${counts[value]} (${formatShare(counts[value] / total)})`}
              />
            ))
          )}
        </div>
        {total === 0 ? (
          <p className="vote-legend muted">Be the first to vote.</p>
        ) : (
          <p className="vote-legend">
            {VOTE_VALUES.map((value) => (
              <span key={value} className="vote-legend-item">
                <span className="swatch" style={{ background: VOTE_META[value].color }} aria-hidden="true" />
                {VOTE_META[value].label} {counts[value]}
              </span>
            ))}
            <span className="vote-total">{total === 1 ? "1 vote" : `${total} votes`}</span>
          </p>
        )}
      </div>
    </div>
  );
}
