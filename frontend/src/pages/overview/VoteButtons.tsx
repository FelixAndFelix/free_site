import { useEffect, useState } from "react";
import { Check, LockSimple } from "@phosphor-icons/react";
import {
  VOTE_COOLDOWN_MINUTES,
  VOTE_VALUES,
  type ModuleOverview,
  type ModuleOverviewResponse,
  type VoteValue,
} from "@free-site/shared";
import { apiRequest } from "../../api";
import { errorKey, useI18n } from "../../i18n";
import { VOTE_META } from "../../votes";

interface VoteButtonsProps {
  module: ModuleOverview;
  onChange: (module: ModuleOverview) => void;
}

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
  const { t, locale } = useI18n();
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
      return setError(t(errorKey(result.error)));
    }
    setError("");
    onChange(result.data.module);
  }

  return (
    <>
      <div className="vote-buttons" role="group" aria-label={t("vote.group", { module: module.name })}>
        {VOTE_VALUES.map((value) => {
          const selected = module.myVote === value;
          return (
            <button
              key={value}
              type="button"
              className={selected ? "vote-button selected" : "vote-button"}
              style={selected ? { background: VOTE_META[value].tint, borderColor: VOTE_META[value].color } : undefined}
              aria-pressed={selected}
              disabled={saving || lockedUntil !== null || module.votingClosed}
              onClick={() => castVote(value)}
            >
              {selected ? (
                <Check className="check" weight="bold" aria-hidden="true" />
              ) : (
                <span className="swatch" style={{ background: VOTE_META[value].color }} aria-hidden="true" />
              )}
              {t(VOTE_META[value].labelKey)}
            </button>
          );
        })}
      </div>
      {module.votingEndsAt && (
        <p className="vote-cooldown">
          <LockSimple aria-hidden="true" />
          <span>
            {t(module.votingClosed ? "vote.closed" : "vote.closesOn", {
              date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(module.votingEndsAt)),
            })}
          </span>
        </p>
      )}
      {lockedUntil && !module.votingClosed && (
        <p className="vote-cooldown">
          <LockSimple aria-hidden="true" />
          <span>
            {t("vote.cooldown", {
              time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(lockedUntil),
              minutes: VOTE_COOLDOWN_MINUTES,
            })}
          </span>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
