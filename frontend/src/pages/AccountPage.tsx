import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { apiRequest, errorMessage } from "../api";
import { useAuth } from "../auth";
import { Field } from "../Field";

/** The user's account: who they are, a link to change the username, and deleting the account. */
export function AccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  /** Deletes the account after the password check and shows the goodbye page. */
  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    setDeleting(true);
    const result = await apiRequest("/api/auth/account", { method: "DELETE", body: { password } });
    setDeleting(false);
    if (!result.ok) return setError(errorMessage(result.error));
    // The goodbye page forgets the user; doing it here would let this page's guard redirect to the login first.
    navigate("/account-deleted", { replace: true, state: { deleted: true } });
  }

  return (
    <div className="stack">
      <Link to="/">← All modules</Link>
      <h1>Account</h1>
      <section className="card">
        <h2>Your details</h2>
        <p>
          Username: <strong>{user?.username}</strong> · <Link to="/username">Change</Link>
        </p>
        <p>
          Email: {user?.email} <span className="muted">(only admins see it)</span>
        </p>
      </section>
      <form className="card" onSubmit={deleteAccount}>
        <h2>Delete account</h2>
        <p>
          This deletes your account, your email address, your username and your votes. The vote totals of your course
          change accordingly. The anonymous vote history, which contains no link to you, stays. This cannot be undone.
        </p>
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onValue={setPassword}
        />
        <label className="checkbox">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          I understand that my account is deleted permanently.
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="danger" disabled={!confirmed || deleting}>
          Delete my account
        </button>
      </form>
    </div>
  );
}
