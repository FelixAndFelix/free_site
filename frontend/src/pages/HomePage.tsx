import { useCallback, useEffect, useState } from "react";
import type { ApiErrorCode, CourseEvent, ModuleOverview, OverviewResponse } from "@free-site/shared";
import { apiRequest } from "../api";
import { errorKey, useI18n } from "../i18n";
import { useCourseEvents } from "../useCourseEvents";
import { ModuleTile } from "./overview/ModuleTile";

/** Overview of the user's course: every module grouped by semester, with vote shares and vote buttons. */
export function HomePage() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  // The code, not the text, so the message follows a change of language.
  const [error, setError] = useState<ApiErrorCode | null>(null);

  const loadOverview = useCallback(async () => {
    const result = await apiRequest<OverviewResponse>("/api/overview");
    if (!result.ok) return setError(result.error);
    setError(null);
    setOverview(result.data);
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  /** Applies a live update: new counts in place, or a reload when the module list changed. */
  function handleEvent(event: CourseEvent) {
    if (event.type === "modules-changed") return void loadOverview();
    setOverview(
      (current) =>
        current && {
          ...current,
          modules: current.modules.map((module) =>
            module.id === event.moduleId ? { ...module, counts: event.counts } : module,
          ),
        },
    );
  }

  useCourseEvents(handleEvent, loadOverview);

  /** Replaces one module after the user voted on it. */
  function updateModule(updated: ModuleOverview) {
    setOverview((current) =>
      current && { ...current, modules: current.modules.map((module) => (module.id === updated.id ? updated : module)) },
    );
  }

  const openModules = overview?.modules.filter((module) => !module.votingClosed) ?? [];
  const pastModules = overview?.modules.filter((module) => module.votingClosed) ?? [];
  const semesters = [...new Set(openModules.map((module) => module.semester))];

  return (
    <div className="stack-lg">
      <header className="page-intro">
        <h1>{overview?.course?.name ?? t("home.fallbackTitle")}</h1>
        <p className="muted">{t("home.intro")}</p>
      </header>
      {error && <p role="alert">{t(errorKey(error))}</p>}
      {!overview && !error && <OverviewSkeleton />}
      {overview && !overview.course && (
        <p className="empty-state">{t("home.noCourse")}</p>
      )}
      {overview?.course && overview.modules.length === 0 && (
        <p className="empty-state">{t("home.noModules")}</p>
      )}
      {semesters.map((semester) => {
        const inSemester = openModules.filter((module) => module.semester === semester);
        return (
          <section key={semester} className="semester" aria-labelledby={`semester-${semester}`}>
            <div className="semester-head">
              <h2 id={`semester-${semester}`}>{t("common.semester", { number: semester })}</h2>
              <span className="semester-count">{t("home.moduleCount", { count: inSemester.length })}</span>
            </div>
            <div className="module-grid">
              {inSemester.map((module) => (
                <ModuleTile key={module.id} module={module} onChange={updateModule} />
              ))}
            </div>
          </section>
        );
      })}
      {pastModules.length > 0 && (
        <details className="past-modules">
          <summary>
            <h2>{t("home.past")}</h2>
            <span className="semester-count">{t("home.moduleCount", { count: pastModules.length })}</span>
          </summary>
          <p className="muted">{t("home.pastHint")}</p>
          <div className="module-grid">
            {pastModules.map((module) => (
              <ModuleTile key={module.id} module={module} onChange={updateModule} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** Grey placeholders in the shape of module tiles while the overview loads. */
function OverviewSkeleton() {
  const { t } = useI18n();
  return (
    <div className="module-grid" role="status" aria-label={t("home.loadingModules")}>
      {[0, 1, 2].map((index) => (
        <div key={index} className="card module-tile skeleton" aria-hidden="true">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line" />
          <span className="skeleton-line skeleton-bar" />
          <span className="skeleton-line skeleton-buttons" />
        </div>
      ))}
    </div>
  );
}
