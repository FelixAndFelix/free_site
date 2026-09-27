import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { PASSWORD_MIN_LENGTH, type UserResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../api";
import { useAuth } from "../auth";
import { Field } from "../Field";
import { USERNAME_HINT } from "./UsernamePage";

/** Two-step registration: email and course code, then emailed code and password. */
export function RegisterPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [adminSetupCode, setAdminSetupCode] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  /** Asks the backend to email a verification code. */
  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    const result = await apiRequest("/api/auth/register/start", { body: { email, username, courseCode, adminSetupCode } });
    if (!result.ok) return setError(errorMessage(result.error));
    setError("");
    setStep("verify");
  }

  /** Creates the account and opens the home screen on success. */
  async function complete(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest<UserResponse>("/api/auth/register/complete", {
      body: { email, username, courseCode, code, password, adminSetupCode },
    });
    if (!result.ok) return setError(errorMessage(result.error));
    setUser(result.data.user);
    navigate("/");
  }

  if (step === "details") {
    return (
      <form className="card" onSubmit={requestCode}>
        <h1>Create an account</h1>
        <Field label="DHBW email" type="email" autoComplete="email" value={email} onValue={setEmail} />
        <Field label="Username" autoComplete="username" value={username} onValue={setUsername} />
        <p className="muted">{USERNAME_HINT}</p>
        <Field label="Course code" placeholder="INF24B-7KQ2XMPA" value={courseCode} onValue={setCourseCode} />
        <details>
          <summary>I have an admin setup code</summary>
          <Field label="Admin setup code" required={false} value={adminSetupCode} onValue={setAdminSetupCode} />
        </details>
        {error && <p role="alert">{error}</p>}
        <p className="muted">
          Other users only see vote totals. <Link to="/privacy">How your data is handled</Link>
        </p>
        <button type="submit">Send code</button>
        <p>
          <Link to="/login">I already have an account</Link>
        </p>
      </form>
    );
  }

  return (
    <form className="card" onSubmit={complete}>
      <h1>Check your email</h1>
      <p>We sent a 6-digit code to {email}. It is valid for 10 minutes.</p>
      <Field label="Code" inputMode="numeric" autoComplete="one-time-code" value={code} onValue={setCode} />
      <Field
        label={`Password (at least ${PASSWORD_MIN_LENGTH} characters)`}
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        value={password}
        onValue={setPassword}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Create account</button>
      <button type="button" className="secondary" onClick={() => requestCode()}>
        Send a new code
      </button>
    </form>
  );
}
