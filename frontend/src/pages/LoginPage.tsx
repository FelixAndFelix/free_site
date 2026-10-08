import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { UserResponse } from "@free-site/shared";
import { apiRequest } from "../api";
import { useAuth } from "../auth";
import { Field } from "../Field";
import { errorKey, useI18n } from "../i18n";

/** Login with email and password. */
export function LoginPage() {
  const { setUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  // Set when the visitor came from an invite link: after logging in they continue there.
  const joinCode = useSearchParams()[0].get("join");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  /** Logs in and opens the home screen on success. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest<UserResponse>("/api/auth/login", { body: { email, password } });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setUser(result.data.user);
    navigate(joinCode ? `/join/${encodeURIComponent(joinCode)}` : "/");
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>{t("login.title")}</h1>
      <Field label={t("field.email")} type="email" autoComplete="email" value={email} onValue={setEmail} />
      <Field
        label={t("field.password")}
        type="password"
        autoComplete="current-password"
        value={password}
        onValue={setPassword}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">{t("login.title")}</button>
      <p>
        <Link to={joinCode ? `/register?join=${encodeURIComponent(joinCode)}` : "/register"}>
          {t("login.createAccount")}
        </Link>{" "}
        · <Link to="/reset">{t("login.forgot")}</Link>
      </p>
    </form>
  );
}
