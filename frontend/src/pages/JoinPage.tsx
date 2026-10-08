import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { JoinResponse } from "@free-site/shared";
import { apiRequest } from "../api";
import { useAuth } from "../auth";
import { errorKey, useI18n } from "../i18n";
import { useJoinInfo } from "../useJoinInfo";

/**
 * Landing page of an invite link (/join/<course join code>). Guests are sent on to registration
 * or login with the course attached; logged-in users join the course in one click, or confirm
 * switching when they are in another course.
 */
export function JoinPage() {
  const { code = "" } = useParams();
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const lookup = useJoinInfo(code, user?.id);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  /** Joins the course, switching away from the current one when the user confirmed it. */
  async function join(confirmSwitch: boolean) {
    setJoining(true);
    const result = await apiRequest<JoinResponse>(`/api/join/${encodeURIComponent(code)}`, {
      body: { confirmSwitch },
    });
    setJoining(false);
    if (!result.ok) return setError(t(errorKey(result.error)));
    navigate("/");
  }

  if (loading || lookup.status === "loading" || lookup.status === "none") {
    return (
      <p className="muted" role="status">
        {t("common.loading")}
      </p>
    );
  }

  if (lookup.status === "failed") {
    return (
      <div className="card">
        <h1>{t("join.invalidTitle")}</h1>
        <p role="alert">{lookup.error === "not_found" ? t("join.invalidText") : t(errorKey(lookup.error))}</p>
        <Link to="/">{t("join.toStart")}</Link>
      </div>
    );
  }

  const { info } = lookup;
  const course = info.course.name;
  const target = encodeURIComponent(code);

  if (!user) {
    return (
      <div className="card">
        <h1>{t("join.title", { course })}</h1>
        <p>{t("join.guestText")}</p>
        <Link to={`/register?join=${target}`} className="button">
          {t("join.createAccount")}
        </Link>
        <Link to={`/login?join=${target}`} className="button secondary">
          {t("join.login")}
        </Link>
      </div>
    );
  }

  if (info.membership === "same") {
    return (
      <div className="card">
        <h1>{t("join.sameTitle", { course })}</h1>
        <p>{t("join.sameText")}</p>
        <Link to="/" className="button">
          {t("join.openOverview")}
        </Link>
      </div>
    );
  }

  if (info.membership === "other") {
    const current = info.currentCourseName ?? "";
    return (
      <div className="card">
        <h1>{t("join.switchTitle", { course })}</h1>
        <p>{t("join.switchText", { current, course })}</p>
        {error && <p role="alert">{error}</p>}
        <button type="button" disabled={joining} onClick={() => join(true)}>
          {t("join.switchButton", { course })}
        </button>
        <Link to="/" className="button secondary">
          {t("join.stay", { current })}
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>{t("join.title", { course })}</h1>
      <p>{t("join.noCourseText", { course })}</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" disabled={joining} onClick={() => join(false)}>
        {t("join.button", { course })}
      </button>
    </div>
  );
}
