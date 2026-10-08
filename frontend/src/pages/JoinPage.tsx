import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { JoinResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../api";
import { useAuth } from "../auth";
import { useJoinInfo } from "../useJoinInfo";

/**
 * Landing page of an invite link (/join/<course join code>). Guests are sent on to registration
 * or login with the course attached; logged-in users join the course in one click, or confirm
 * switching when they are in another course.
 */
export function JoinPage() {
  const { code = "" } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const lookup = useJoinInfo(code, user?.id);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  /** Joins the course, switching away from the current one when the user confirmed it. */
  async function join(confirmSwitch: boolean) {
    setJoining(true);
    const result = await apiRequest<JoinResponse>(`/api/join/${encodeURIComponent(code)}`, {
      body: { confirmSwitch },
    });
    setJoining(false);
    if (!result.ok) return setError(errorMessage(result.error));
    navigate("/");
  }

  if (loading || lookup.status === "loading" || lookup.status === "none") {
    return (
      <p className="muted" role="status">
        Loading…
      </p>
    );
  }

  if (lookup.status === "failed") {
    return (
      <div className="card">
        <h1>Invite link not valid</h1>
        <p role="alert">
          {lookup.error === "not_found"
            ? "This link is wrong or was replaced. Ask an admin of your course for a new one."
            : errorMessage(lookup.error)}
        </p>
        <Link to="/">Go to the start page</Link>
      </div>
    );
  }

  const { info } = lookup;
  const courseName = info.course.name;
  const target = encodeURIComponent(code);

  if (!user) {
    return (
      <div className="card">
        <h1>Join {courseName}</h1>
        <p>Vote with your course on which exams are free. Create an account, or log in if you already have one.</p>
        <Link to={`/register?join=${target}`} className="button">
          Create account
        </Link>
        <Link to={`/login?join=${target}`} className="button secondary">
          Log in
        </Link>
      </div>
    );
  }

  if (info.membership === "same") {
    return (
      <div className="card">
        <h1>You are in {courseName}</h1>
        <p>This invite link is for your own course, so there is nothing to do.</p>
        <Link to="/" className="button">
          Open the overview
        </Link>
      </div>
    );
  }

  if (info.membership === "other") {
    return (
      <div className="card">
        <h1>Switch to {courseName}?</h1>
        <p>
          You are in {info.currentCourseName} right now. If you switch, your votes there are removed and you vote with{" "}
          {courseName} instead.
        </p>
        {error && <p role="alert">{error}</p>}
        <button type="button" disabled={joining} onClick={() => join(true)}>
          Switch to {courseName}
        </button>
        <Link to="/" className="button secondary">
          Stay in {info.currentCourseName}
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>Join {courseName}</h1>
      <p>You are not in a course yet. Join to vote on the modules of {courseName}.</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" disabled={joining} onClick={() => join(false)}>
        Join {courseName}
      </button>
    </div>
  );
}
