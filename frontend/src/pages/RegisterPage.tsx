import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type UserResponse,
} from "@free-site/shared";
import { apiRequest } from "../api";
import { useAuth } from "../auth";
import { Field } from "../Field";
import { errorKey, useI18n } from "../i18n";
import { useJoinInfo } from "../useJoinInfo";

/** Two-step registration: email and course code, then emailed code and password. */
export function RegisterPage() {
  const { setUser } = useAuth();
  const { t, tNodes, language } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  // Set when the visitor came from an invite link: the course is known, so it is not asked for again.
  const joinCode = useSearchParams()[0].get("join");
  const invite = useJoinInfo(joinCode);
  const [courseCode, setCourseCode] = useState(joinCode ?? "");
  const [adminSetupCode, setAdminSetupCode] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  /** Asks the backend to email a verification code, written in the language the page is shown in. */
  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    const result = await apiRequest("/api/auth/register/start", {
      body: { email, username, courseCode, adminSetupCode, language },
    });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    setStep("verify");
  }

  /** Creates the account, which keeps the page's language, and opens the home screen on success. */
  async function complete(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest<UserResponse>("/api/auth/register/complete", {
      body: { email, username, courseCode, code, password, adminSetupCode, language },
    });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setUser(result.data.user);
    navigate("/");
  }

  if (step === "details") {
    return (
      <form className="card" onSubmit={requestCode}>
        <h1>{t("register.title")}</h1>
        <Field label={t("field.email")} type="email" autoComplete="email" value={email} onValue={setEmail} />
        <Field label={t("field.username")} autoComplete="username" value={username} onValue={setUsername} />
        <p className="muted">{t("username.hint", { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH })}</p>
        {invite.status === "ready" ? (
          <p>{tNodes("register.joining", { course: <strong>{invite.info.course.name}</strong> })}</p>
        ) : invite.status === "loading" ? (
          <p className="muted" role="status">
            {t("register.checkingInvite")}
          </p>
        ) : (
          <>
            {invite.status === "failed" && <p role="alert">{t("register.inviteInvalid")}</p>}
            <Field
              label={t("field.courseCode")}
              placeholder="INF24B-7KQ2XMPA"
              value={courseCode}
              onValue={setCourseCode}
            />
          </>
        )}
        <details>
          <summary>{t("register.adminCode")}</summary>
          <Field label={t("field.adminCode")} required={false} value={adminSetupCode} onValue={setAdminSetupCode} />
        </details>
        {error && <p role="alert">{error}</p>}
        <p className="muted">
          {t("register.dataNote")} <Link to="/privacy">{t("register.dataLink")}</Link>
        </p>
        <button type="submit">{t("common.sendCode")}</button>
        <p>
          <Link to={joinCode ? `/login?join=${encodeURIComponent(joinCode)}` : "/login"}>
            {t("register.haveAccount")}
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form className="card" onSubmit={complete}>
      <h1>{t("register.verifyTitle")}</h1>
      <p>{t("register.verifyText", { email })}</p>
      <Field label={t("field.code")} inputMode="numeric" autoComplete="one-time-code" value={code} onValue={setCode} />
      <Field
        label={t("field.passwordMin", { min: PASSWORD_MIN_LENGTH })}
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        value={password}
        onValue={setPassword}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">{t("register.create")}</button>
      <button type="button" className="secondary" onClick={() => requestCode()}>
        {t("register.resend")}
      </button>
    </form>
  );
}
