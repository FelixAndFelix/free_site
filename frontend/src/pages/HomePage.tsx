import { useAuth } from "../auth";

/** Placeholder home screen until the module overview exists (build step 4). */
export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="card">
      <h1>free_site</h1>
      <p>Logged in as {user?.email}</p>
      <button type="button" className="secondary" onClick={logout}>
        Log out
      </button>
    </div>
  );
}
