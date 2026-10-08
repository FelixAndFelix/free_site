import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { PASSWORD_MIN_LENGTH } from "@free-site/shared";
import { apiRequest } from "../api";
import { Field } from "../Field";
import { errorKey, useI18n } from "../i18n";

/** Password reset: email, then emailed code and a new password. */
export function ResetPage() {
  const { t, language } = useI18n();
  const [step, setStep] = useState<"email" | "verify" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  /** Asks the backend to email a reset code if the account exists, written in the language of the page. */
  async function requestCode(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest("/api/auth/reset/start", { body: { email, language } });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    setStep("verify");
  }

  /** Sets the new password. */
  async function complete(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest("/api/auth/reset/complete", { body: { email, code, password } });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="card">
        <h1>{t("reset.doneTitle")}</h1>
        <p>{t("reset.doneText")}</p>
        <Link to="/login">{t("login.title")}</Link>
      </div>
    );
  }

  if (step === "email") {
    return (
      <form className="card" onSubmit={requestCode}>
        <h1>{t("reset.title")}</h1>
        <Field label={t("field.email")} type="email" autoComplete="email" value={email} onValue={setEmail} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">{t("common.sendCode")}</button>
        <p>
          <Link to="/login">{t("reset.backToLogin")}</Link>
        </p>
      </form>
    );
  }

  return (
    <form className="card" onSubmit={complete}>
      <h1>{t("reset.verifyTitle")}</h1>
      <p>{t("reset.verifyText", { email })}</p>
      <Field label={t("field.code")} inputMode="numeric" autoComplete="one-time-code" value={code} onValue={setCode} />
      <Field
        label={t("field.newPasswordMin", { min: PASSWORD_MIN_LENGTH })}
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        value={password}
        onValue={setPassword}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">{t("reset.setPassword")}</button>
    </form>
  );
}
