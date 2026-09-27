import { useEffect, useState } from "react";
import {
  VOTE_COOLDOWN_MINUTES,
  VOTE_VALUES,
  type ModuleOverview,
  type ModuleOverviewResponse,
  type VoteValue,
} from "@free-site/shared";
import { apiRequest, errorMessage } from "../../api";
import { VOTE_META } from "../../votes";

interface VoteButtonsProps {
  module: ModuleOverview;
  onChange: (module: ModuleOverview) => void;
}

const clockTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * Returns the later of two optional ISO times, or null if neither is in the future.
 * @param {string | null | undefined} first
 * @param {string | null | undefined} second
 */
function laterFutureTime(first: string | null | undefined, second: string | null | undefined): Date | null {
  const times = [first, second].filter(Boolean).map((time) => new Date(time!));
  const latest = times.sort((a, b) => b.getTime() - a.getTime())[0];
  return latest && latest.getTime() > Date.now() ? latest : null;
}

/**
 * Re-renders once the given time has passed, so a cooldown ends without a reload.
 * @param {Date | null} until
 */
function useRerenderAt(until: Date | null) {
  const [, setTick] = useState(0);
  // A number, not the Date, so a new Date for the same moment does not restart the timer.
  const untilMs = until?.getTime() ?? null;
  useEffect(() => {
    if (untilMs === null) return;
    const timer = setTimeout(() => setTick((tick) => tick + 1), untilMs - Date.now() + 250);
    return () => clearTimeout(timer);
  }, [untilMs]);
}

/**
 * The user's three vote buttons for a module. Clicking the current vote again withdraws it.
 * After a change the buttons are locked for VOTE_COOLDOWN_MINUTES; the server enforces the same rule.
 * @param {VoteButtonsProps} props
 */
export function VoteButtons({ module, onChange }: VoteButtonsProps) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Set when the server refused a change, e.g. because another tab voted in the meantime.
  const [refusedUntil, setRefusedUntil] = useState<string | undefined>();
  const lockedUntil = laterFutureTime(module.canChangeAt, refusedUntil);
  useRerenderAt(lockedUntil);

  /** Casts, changes or withdraws the user's vote. */
  async function castVote(value: VoteValue) {
    setSaving(true);
    const path = `/api/modules/${module.id}/vote`;
    const result =
      module.myVote === value
        ? await apiRequest<ModuleOverviewResponse>(path, { method: "DELETE" })
        : await apiRequest<ModuleOverviewResponse>(path, { method: "PUT", body: { value } });
    setSaving(false);
    if (!result.ok) {
      if (result.error === "vote_cooldown") return setRefusedUntil(result.retryAt);
      return setError(errorMessage(result.error));
    }
    setError("");
    onChange(result.data.module);
  }

  return (
    <>
      <div className="vote-buttons" role="group" aria-label={`Your vote for ${module.name}`}>
        {VOTE_VALUES.map((value) => {
          const selected = module.myVote === value;
          return (
            <button
              key={value}
              type="button"
              className={selected ? "vote-button selected" : "vote-button"}
              style={selected ? { background: VOTE_META[value].tint, borderColor: VOTE_META[value].color } : undefined}
              aria-pressed={selected}
              disabled={saving || lockedUntil !== null}
              onClick={() => castVote(value)}
            >
              <span className="swatch" style={{ background: VOTE_META[value].color }} aria-hidden="true" />
              {VOTE_META[value].label}
              {selected && (
                <span className="check" aria-hidden="true">
                  {" "}
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
      {lockedUntil && (
        <p className="muted vote-cooldown">
          You can change your vote again at {clockTime.format(lockedUntil)} (once every {VOTE_COOLDOWN_MINUTES} minutes).
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
