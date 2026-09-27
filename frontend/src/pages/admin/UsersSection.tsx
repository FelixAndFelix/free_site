import { useCallback, useEffect, useState } from "react";
import type { AdminUserEntry, UsersResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../../api";
import { useAuth } from "../../auth";

/** Lists all users and lets admins promote or demote everyone except themselves. */
export function UsersSection() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUserEntry[]>([]);
  const [error, setError] = useState("");

  const reloadUsers = useCallback(async () => {
    const result = await apiRequest<UsersResponse>("/api/admin/users");
    if (!result.ok) return setError(errorMessage(result.error));
    setUsers(result.data.users);
  }, []);

  useEffect(() => {
    reloadUsers();
  }, [reloadUsers]);

  /** Switches a user between the user and admin role. */
  async function toggleRole(user: AdminUserEntry) {
    const role = user.role === "admin" ? "user" : "admin";
    const result = await apiRequest(`/api/admin/users/${user.id}`, { method: "PATCH", body: { role } });
    if (!result.ok) return setError(errorMessage(result.error));
    await reloadUsers();
  }

  return (
    <section className="card">
      <h2>Users</h2>
      <ul className="list">
        {users.map((user) => (
          <li key={user.id} className="row">
            <span>
              <strong>{user.username ?? "(no username yet)"}</strong> {user.email}
              <span className="muted">
                {" "}
                · {user.courseName ?? "no course"}
                {user.role === "admin" && " · admin"}
              </span>
            </span>
            {user.id !== currentUser?.id && (
              <button type="button" className="secondary" onClick={() => toggleRole(user)}>
                {user.role === "admin" ? "Remove admin" : "Make admin"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
