import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { ApiErrorCode, ModuleDetailResponse } from "@free-site/shared";
import { apiRequest } from "../../api";
import { errorKey, useI18n } from "../../i18n";
import { useCourseEvents } from "../../useCourseEvents";
import { VoteBar } from "../overview/VoteBar";
import { GradeBox } from "../overview/GradeBox";
import { VoteButtons } from "../overview/VoteButtons";
import { HistoryChart } from "./HistoryChart";
import { BackLink } from "../../BackLink";

/** Detail view of one module: current shares, the user's vote and the vote history over time. */
export function ModulePage() {
  const { moduleId } = useParams();
  const { t } = useI18n();
  const [detail, setDetail] = useState<ModuleDetailResponse | null>(null);
  const [error, setError] = useState<ApiErrorCode | null>(null);

  const loadDetail = useCallback(async () => {
    const result = await apiRequest<ModuleDetailResponse>(`/api/modules/${moduleId}`);
    if (!result.ok) return setError(result.error);
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
        <p role="alert">{t(errorKey(error))}</p>
        <Link to="/">{t("module.backToOverview")}</Link>
      </div>
    );
  }
  if (!detail) return <p className="muted" role="status">{t("common.loading")}</p>;
  const { module, history } = detail;

  return (
    <div className="stack-lg">
      <header className="page-intro">
        <BackLink to="/">{t("common.allModules")}</BackLink>
        <h1>{module.name}</h1>
        <p className="muted">{t("common.semester", { number: module.semester })}</p>
      </header>
      <section className="card verdict-panel" aria-labelledby="right-now">
        <h2 id="right-now" className="visually-hidden">
          {t("module.rightNow")}
        </h2>
        <VoteBar counts={module.counts} size="large" />
        <div className="your-vote">
          <h3>{t("module.yourVote")}</h3>
          {/* A vote changes today's point in the history, so the whole detail is reloaded. */}
          <VoteButtons module={module} onChange={loadDetail} />
        </div>
        {module.votingClosed && <GradeBox module={module} onChange={loadDetail} />}
      </section>
      <section className="card" aria-labelledby="over-time">
        <div className="card-head">
          <h2 id="over-time">{t("module.overTime")}</h2>
          {history.length > 0 && (
            <p className="muted">{t("module.historyHint")}</p>
          )}
        </div>
        {history.length === 0 ? (
          <p className="muted">{t("module.noHistory")}</p>
        ) : (
          <HistoryChart history={history} />
        )}
      </section>
    </div>
  );
}
