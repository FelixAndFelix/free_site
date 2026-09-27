import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, type UserResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../api";
import { useAuth } from "../auth";
import { Field } from "../Field";

export const USERNAME_HINT = `${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} letters, digits, ".", "_" or "-". Shown instead of your email.`;

/**
 * Sets or changes the username. Accounts without one see this screen right after login.
 * @param {{required?: boolean}} props required: the account has no username yet, so there is no way back
 */
export function UsernamePage({ required = false }: { required?: boolean }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username ?? "");
  const [error, setError] = useState("");

  /** Saves the username and returns to the home screen. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest<UserResponse>("/api/auth/username", { method: "PUT", body: { username } });
    if (!result.ok) return setError(errorMessage(result.error));
    setUser(result.data.user);
    navigate("/");
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>{required ? "Choose a username" : "Change username"}</h1>
      <p className="muted">{USERNAME_HINT}</p>
      <Field label="Username" autoComplete="username" value={username} onValue={setUsername} />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Save username</button>
      {!required && <Link to="/">Back</Link>}
    </form>
  );
}
