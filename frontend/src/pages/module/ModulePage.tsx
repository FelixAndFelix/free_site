import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { ModuleDetailResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../../api";
import { VoteBar } from "../overview/VoteBar";
import { VoteButtons } from "../overview/VoteButtons";
import { HistoryChart } from "./HistoryChart";

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

  if (error) {
    return (
      <div className="stack">
        <p role="alert">{error}</p>
        <Link to="/">Back to the overview</Link>
      </div>
    );
  }
  if (!detail) return <p>Loading...</p>;
  const { module, history } = detail;

  return (
    <div className="stack">
      <Link to="/">← All modules</Link>
      <header>
        <h1>{module.name}</h1>
        <p className="muted">Semester {module.semester}</p>
      </header>
      <section className="card">
        <h2>Right now</h2>
        <VoteBar counts={module.counts} />
        {/* A vote changes today's point in the history, so the whole detail is reloaded. */}
        <VoteButtons module={module} onChange={loadDetail} />
      </section>
      <section className="card">
        <h2>Over time</h2>
        {history.length === 0 ? (
          <p className="muted">No votes yet. The history starts with the first vote.</p>
        ) : (
          <>
            <p className="muted">How many classmates held each opinion at the end of each day.</p>
            <HistoryChart history={history} />
          </>
        )}
      </section>
    </div>
  );
}
