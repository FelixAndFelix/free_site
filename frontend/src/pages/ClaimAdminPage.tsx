import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { UserResponse } from "@free-site/shared";
import { apiRequest } from "../api";
import { useAuth } from "../auth";
import { Field } from "../Field";
import { errorKey, useI18n } from "../i18n";

/** Lets an existing account become the first admin with ADMIN_SETUP_CODE. Not linked; see docs/deployment.md. */
export function ClaimAdminPage() {
  const { setUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [adminSetupCode, setAdminSetupCode] = useState("");
  const [error, setError] = useState("");

  /** Claims the admin role and opens the admin page on success. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest<UserResponse>("/api/auth/claim-admin", { body: { adminSetupCode } });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setUser(result.data.user);
    navigate("/admin");
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>{t("claim.title")}</h1>
      <p>{t("claim.text")}</p>
      <Field label={t("field.adminCode")} value={adminSetupCode} onValue={setAdminSetupCode} />
      {error && <p role="alert">{error}</p>}
      <button type="submit">{t("claim.submit")}</button>
      <Link to="/">{t("common.back")}</Link>
    </form>
  );
}
