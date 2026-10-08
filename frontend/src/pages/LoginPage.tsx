import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { UserResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../api";
import { useAuth } from "../auth";
import { Field } from "../Field";

/** Login with email and password. */
export function LoginPage() {
  const { setUser } = useAuth();
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
    if (!result.ok) return setError(errorMessage(result.error));
    setUser(result.data.user);
    navigate(joinCode ? `/join/${encodeURIComponent(joinCode)}` : "/");
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>Log in</h1>
      <Field label="DHBW email" type="email" autoComplete="email" value={email} onValue={setEmail} />
      <Field label="Password" type="password" autoComplete="current-password" value={password} onValue={setPassword} />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Log in</button>
      <p>
        <Link to={joinCode ? `/register?join=${encodeURIComponent(joinCode)}` : "/register"}>Create an account</Link> · <Link to="/reset">Forgot password?</Link>
      </p>
    </form>
  );
}
