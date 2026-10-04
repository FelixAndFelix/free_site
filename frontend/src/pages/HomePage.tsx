import { useCallback, useEffect, useState } from "react";
import type { CourseEvent, ModuleOverview, OverviewResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../api";
import { useCourseEvents } from "../useCourseEvents";
import { ModuleTile } from "./overview/ModuleTile";

/** Overview of the user's course: every module grouped by semester, with vote shares and vote buttons. */
export function HomePage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    const result = await apiRequest<OverviewResponse>("/api/overview");
    if (!result.ok) return setError(errorMessage(result.error));
    setError("");
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

  const semesters = [...new Set(overview?.modules.map((module) => module.semester))];

  return (
    <div className="stack-lg">
      <header className="page-intro">
        <h1>{overview?.course?.name ?? "Your course"}</h1>
        <p className="muted">Which exams are free? Vote on each module; everyone sees the totals.</p>
      </header>
      {error && <p role="alert">{error}</p>}
      {!overview && !error && <OverviewSkeleton />}
      {overview && !overview.course && (
        <p className="empty-state">You are not in a course yet. Ask an admin to add you to one.</p>
      )}
      {overview?.course && overview.modules.length === 0 && (
        <p className="empty-state">There are no modules in this course yet. An admin adds them.</p>
      )}
      {semesters.map((semester) => {
        const inSemester = overview!.modules.filter((module) => module.semester === semester);
        return (
          <section key={semester} className="semester" aria-labelledby={`semester-${semester}`}>
            <div className="semester-head">
              <h2 id={`semester-${semester}`}>Semester {semester}</h2>
              <span className="semester-count">
                {inSemester.length === 1 ? "1 module" : `${inSemester.length} modules`}
              </span>
            </div>
            <div className="module-grid">
              {inSemester.map((module) => (
                <ModuleTile key={module.id} module={module} onChange={updateModule} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Grey placeholders in the shape of module tiles while the overview loads. */
function OverviewSkeleton() {
  return (
    <div className="module-grid" role="status" aria-label="Loading modules">
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
