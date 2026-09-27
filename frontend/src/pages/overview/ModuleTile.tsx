import { useState } from "react";
import { VOTE_VALUES, type ModuleOverview, type ModuleOverviewResponse, type VoteValue } from "@free-site/shared";
import { apiRequest, errorMessage } from "../../api";
import { VOTE_META } from "../../votes";
import { VoteBar } from "./VoteBar";

interface ModuleTileProps {
  module: ModuleOverview;
  onChange: (module: ModuleOverview) => void;
}

/**
 * One module: the course's vote shares and the user's own vote buttons.
 * Clicking the current vote again withdraws it.
 * @param {ModuleTileProps} props
 */
export function ModuleTile({ module, onChange }: ModuleTileProps) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /** Casts, changes or withdraws the user's vote. */
  async function castVote(value: VoteValue) {
    setSaving(true);
    const path = `/api/modules/${module.id}/vote`;
    const result =
      module.myVote === value
        ? await apiRequest<ModuleOverviewResponse>(path, { method: "DELETE" })
        : await apiRequest<ModuleOverviewResponse>(path, { method: "PUT", body: { value } });
    setSaving(false);
    if (!result.ok) return setError(errorMessage(result.error));
    setError("");
    onChange(result.data.module);
  }

  return (
    <article className="card module-tile">
      <h3>{module.name}</h3>
      <VoteBar counts={module.counts} />
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
              disabled={saving}
              onClick={() => castVote(value)}
            >
              <span className="swatch" style={{ background: VOTE_META[value].color }} aria-hidden="true" />
              {VOTE_META[value].label}
              {selected && <span className="check" aria-hidden="true"> ✓</span>}
            </button>
          );
        })}
      </div>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
