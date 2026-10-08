import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { isLanguage, LANGUAGES, type UserResponse } from "@free-site/shared";
import { apiRequest } from "../api";
import { useAuth } from "../auth";
import { BackLink } from "../BackLink";
import { Field } from "../Field";
import { errorKey, LANGUAGE_NAMES, useI18n } from "../i18n";

/** The user's account: who they are, their language, a link to change the username, and deleting the account. */
export function AccountPage() {
  const { user, setUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [languageError, setLanguageError] = useState("");
  const [deleting, setDeleting] = useState(false);

  /** Saves the interface language on the account; the page follows as soon as the answer arrives. */
  async function changeLanguage(event: ChangeEvent<HTMLSelectElement>) {
    if (!isLanguage(event.target.value)) return;
    const result = await apiRequest<UserResponse>("/api/auth/language", {
      method: "PUT",
      body: { language: event.target.value },
    });
    if (!result.ok) return setLanguageError(t(errorKey(result.error)));
    setLanguageError("");
    setUser(result.data.user);
  }

  /** Deletes the account after the password check and shows the goodbye page. */
  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    setDeleting(true);
    const result = await apiRequest("/api/auth/account", { method: "DELETE", body: { password } });
    setDeleting(false);
    if (!result.ok) return setError(t(errorKey(result.error)));
    // The goodbye page forgets the user; doing it here would let this page's guard redirect to the login first.
    navigate("/account-deleted", { replace: true, state: { deleted: true } });
  }

  return (
    <div className="stack">
      <BackLink to="/">{t("common.allModules")}</BackLink>
      <h1>{t("account.title")}</h1>
      <section className="card">
        <h2>{t("account.details")}</h2>
        <p>
          {t("account.username")} <strong>{user?.username}</strong> · <Link to="/username">{t("account.change")}</Link>
        </p>
        <p>
          {t("account.email")} {user?.email} <span className="muted">{t("account.emailNote")}</span>
        </p>
      </section>
      <section className="card">
        <h2>{t("account.languageTitle")}</h2>
        <label className="field">
          <span>{t("account.languageLabel")}</span>
          <select value={user?.language ?? "en"} onChange={changeLanguage}>
            {LANGUAGES.map((language) => (
              <option key={language} value={language} lang={language}>
                {LANGUAGE_NAMES[language]}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">{t("account.languageHint")}</p>
        {languageError && <p role="alert">{languageError}</p>}
      </section>
      <form className="card" onSubmit={deleteAccount}>
        <h2>{t("account.deleteTitle")}</h2>
        <p>{t("account.deleteText")}</p>
        <Field
          label={t("field.password")}
          type="password"
          autoComplete="current-password"
          value={password}
          onValue={setPassword}
        />
        <label className="checkbox">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          {t("account.deleteConfirm")}
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="danger" disabled={!confirmed || deleting}>
          {t("account.deleteSubmit")}
        </button>
      </form>
    </div>
  );
}
