import { useState, type FormEvent } from "react";
import {
  GRADE_MAX,
  GRADE_MIN,
  MIN_GRADES_SHOWN,
  type ModuleOverview,
  type ModuleOverviewResponse,
} from "@free-site/shared";
import { apiRequest } from "../../api";
import { errorKey, useI18n } from "../../i18n";

interface GradeBoxProps {
  module: ModuleOverview;
  onChange: (module: ModuleOverview) => void;
}

/**
 * For a module whose voting has ended: the user's own grade (1.0 to 5.0) and, once enough
 * classmates entered theirs, the average with best and worst grade. Single grades are never shown.
 * @param {GradeBoxProps} props
 */
export function GradeBox({ module, onChange }: GradeBoxProps) {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState(module.myGrade === null ? "" : String(module.myGrade));
  const [error, setError] = useState("");
  const format = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const path = `/api/modules/${module.id}/grade`;
  const stats = module.gradeStats;

  /** Stores the grade typed in the field. */
  async function save(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest<ModuleOverviewResponse>(path, { method: "PUT", body: { grade: Number(draft) } });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    onChange(result.data.module);
  }

  /** Removes the user's grade again. */
  async function remove() {
    const result = await apiRequest<ModuleOverviewResponse>(path, { method: "DELETE" });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    setDraft("");
    onChange(result.data.module);
  }

  return (
    <div className="grade-box">
      <form className="grade-form" onSubmit={save}>
        <label className="field">
          <span>{t("grade.yours")}</span>
          <input
            type="number"
            inputMode="decimal"
            min={GRADE_MIN}
            max={GRADE_MAX}
            step={0.1}
            value={draft}
            required
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <button type="submit" className="secondary">
          {t("grade.save")}
        </button>
        {module.myGrade !== null && (
          <button type="button" className="secondary" onClick={remove}>
            {t("grade.remove")}
          </button>
        )}
      </form>
      <p className="muted">
        {stats
          ? t("grade.stats", {
              average: format.format(stats.average),
              best: format.format(stats.best),
              worst: format.format(stats.worst),
              count: stats.count,
            })
          : t("grade.hidden", { count: MIN_GRADES_SHOWN })}
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
