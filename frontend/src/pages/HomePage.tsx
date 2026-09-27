import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import type { CourseEvent, ModuleOverview, OverviewResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../api";
import { useAuth } from "../auth";
import { useCourseEvents } from "../useCourseEvents";
import { ModuleTile } from "./overview/ModuleTile";

/** Overview of the user's course: every module grouped by semester, with vote shares and vote buttons. */
export function HomePage() {
  const { user, logout } = useAuth();
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
    <div className="stack">
      <header className="page-header">
        <h1>{overview?.course?.name ?? "free_site"}</h1>
        <button type="button" className="link-button" onClick={logout}>
          Log out
        </button>
      </header>
      <p>
        Logged in as <strong>{user?.username}</strong> · <Link to="/username">Change username</Link>
        {user?.role === "admin" && (
          <>
            {" "}
            · <Link to="/admin">Admin</Link>
          </>
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      {overview && !overview.course && (
        <p className="card">You are not in a course. Ask an admin to add you to one.</p>
      )}
      {overview?.course && overview.modules.length === 0 && (
        <p className="card">There are no modules in this course yet.</p>
      )}
      {semesters.map((semester) => (
        <section key={semester} className="stack">
          <h2>Semester {semester}</h2>
          <div className="module-grid">
            {overview!.modules
              .filter((module) => module.semester === semester)
              .map((module) => (
                <ModuleTile key={module.id} module={module} onChange={updateModule} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
