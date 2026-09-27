import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { PASSWORD_MIN_LENGTH } from "@free-site/shared";
import { apiRequest, errorMessage } from "../api";
import { Field } from "../Field";

/** Password reset: email, then emailed code and a new password. */
export function ResetPage() {
  const [step, setStep] = useState<"email" | "verify" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  /** Asks the backend to email a reset code if the account exists. */
  async function requestCode(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest("/api/auth/reset/start", { email });
    if (!result.ok) return setError(errorMessage(result.error));
    setError("");
    setStep("verify");
  }

  /** Sets the new password. */
  async function complete(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest("/api/auth/reset/complete", { email, code, password });
    if (!result.ok) return setError(errorMessage(result.error));
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="card">
        <h1>Password changed</h1>
        <p>You were logged out on all devices.</p>
        <Link to="/login">Log in</Link>
      </div>
    );
  }

  if (step === "email") {
    return (
      <form className="card" onSubmit={requestCode}>
        <h1>Reset password</h1>
        <Field label="DHBW email" type="email" autoComplete="email" value={email} onValue={setEmail} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Send code</button>
        <p>
          <Link to="/login">Back to login</Link>
        </p>
      </form>
    );
  }

  return (
    <form className="card" onSubmit={complete}>
      <h1>Check your email</h1>
      <p>If an account exists for {email}, we sent it a 6-digit code.</p>
      <Field label="Code" inputMode="numeric" autoComplete="one-time-code" value={code} onValue={setCode} />
      <Field
        label={`New password (at least ${PASSWORD_MIN_LENGTH} characters)`}
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        value={password}
        onValue={setPassword}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Set new password</button>
    </form>
  );
}
