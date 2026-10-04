import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { ModuleDetailResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../../api";
import { useCourseEvents } from "../../useCourseEvents";
import { VoteBar } from "../overview/VoteBar";
import { VoteButtons } from "../overview/VoteButtons";
import { HistoryChart } from "./HistoryChart";
import { BackLink } from "../../BackLink";

/** Detail view of one module: current shares, the user's vote and the vote history over time. */
export function ModulePage() {
  const { moduleId } = useParams();
  const [detail, setDetail] = useState<ModuleDetailResponse | null>(null);
  const [error, setError] = useState("");

  const loadDetail = useCallback(async () => {
    const result = await apiRequest<ModuleDetailResponse>(`/api/modules/${moduleId}`);
    if (!result.ok) return setError(errorMessage(result.error));
    setDetail(result.data);
  }, [moduleId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Someone else's vote changes today's point in the history too, so the detail is reloaded.
  useCourseEvents((event) => {
    if (event.type === "modules-changed" || event.moduleId === moduleId) loadDetail();
  }, loadDetail);

  if (error) {
    return (
      <div className="stack">
        <p role="alert">{error}</p>
        <Link to="/">Back to the overview</Link>
      </div>
    );
  }
  if (!detail) return <p className="muted" role="status">Loading…</p>;
  const { module, history } = detail;

  return (
    <div className="stack-lg">
      <header className="page-intro">
        <BackLink to="/">All modules</BackLink>
        <h1>{module.name}</h1>
        <p className="muted">Semester {module.semester}</p>
      </header>
      <section className="card verdict-panel" aria-labelledby="right-now">
        <h2 id="right-now" className="visually-hidden">
          Right now
        </h2>
        <VoteBar counts={module.counts} size="large" />
        <div className="your-vote">
          <h3>Your vote</h3>
          {/* A vote changes today's point in the history, so the whole detail is reloaded. */}
          <VoteButtons module={module} onChange={loadDetail} />
        </div>
      </section>
      <section className="card" aria-labelledby="over-time">
        <div className="card-head">
          <h2 id="over-time">Over time</h2>
          {history.length > 0 && (
            <p className="muted">How many classmates held each opinion at the end of each day.</p>
          )}
        </div>
        {history.length === 0 ? (
          <p className="muted">No votes yet. The history starts with the first vote.</p>
        ) : (
          <HistoryChart history={history} />
        )}
      </section>
    </div>
  );
}
