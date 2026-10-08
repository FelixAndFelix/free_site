import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, type UserResponse } from "@free-site/shared";
import { apiRequest } from "../api";
import { useAuth } from "../auth";
import { Field } from "../Field";
import { errorKey, useI18n } from "../i18n";

/**
 * Sets or changes the username. Accounts without one see this screen right after login.
 * @param {{required?: boolean}} props required: the account has no username yet, so there is no way back
 */
export function UsernamePage({ required = false }: { required?: boolean }) {
  const { user, setUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username ?? "");
  const [error, setError] = useState("");

  /** Saves the username and returns to the home screen. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest<UserResponse>("/api/auth/username", { method: "PUT", body: { username } });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setUser(result.data.user);
    navigate(required ? "/" : "/account");
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>{required ? t("username.titleRequired") : t("username.titleChange")}</h1>
      <p className="muted">{t("username.hint", { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH })}</p>
      <Field label={t("field.username")} autoComplete="username" value={username} onValue={setUsername} />
      {error && <p role="alert">{error}</p>}
      <button type="submit">{t("username.save")}</button>
      {!required && <Link to="/account">{t("common.back")}</Link>}
    </form>
  );
}
