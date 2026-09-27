import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { UserResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../api";
import { useAuth } from "../auth";
import { Field } from "../Field";

/** Lets an existing account become the first admin with ADMIN_SETUP_CODE. Not linked; see docs/deployment.md. */
export function ClaimAdminPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [adminSetupCode, setAdminSetupCode] = useState("");
  const [error, setError] = useState("");

  /** Claims the admin role and opens the admin page on success. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest<UserResponse>("/api/auth/claim-admin", { body: { adminSetupCode } });
    if (!result.ok) return setError(errorMessage(result.error));
    setUser(result.data.user);
    navigate("/admin");
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>Become admin</h1>
      <p>Only works while there is no admin yet.</p>
      <Field label="Admin setup code" value={adminSetupCode} onValue={setAdminSetupCode} />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Become admin</button>
      <Link to="/">Back</Link>
    </form>
  );
}
