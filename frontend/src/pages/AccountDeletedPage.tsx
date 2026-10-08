import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";

/** Shown after an account was deleted; forgets the logged-in user once it has taken over. */
export function AccountDeletedPage() {
  const { setUser } = useAuth();
  const { t } = useI18n();
  const deleted = (useLocation().state as { deleted?: boolean } | null)?.deleted === true;

  // Only when arriving from a deletion, so opening this URL by hand does not log anyone out locally.
  useEffect(() => {
    if (deleted) setUser(null);
  }, [deleted, setUser]);

  return (
    <div className="card">
      <h1>{t("deleted.title")}</h1>
      <p>{t("deleted.text")}</p>
      <Link to="/register">{t("deleted.create")}</Link>
    </div>
  );
}
