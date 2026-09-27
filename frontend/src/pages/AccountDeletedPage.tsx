import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../auth";

/** Shown after an account was deleted; forgets the logged-in user once it has taken over. */
export function AccountDeletedPage() {
  const { setUser } = useAuth();
  const deleted = (useLocation().state as { deleted?: boolean } | null)?.deleted === true;

  // Only when arriving from a deletion, so opening this URL by hand does not log anyone out locally.
  useEffect(() => {
    if (deleted) setUser(null);
  }, [deleted, setUser]);

  return (
    <div className="card">
      <h1>Account deleted</h1>
      <p>Your account and your votes have been deleted.</p>
      <Link to="/register">Create a new account</Link>
    </div>
  );
}
