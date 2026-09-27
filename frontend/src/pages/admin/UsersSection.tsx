import { useCallback, useEffect, useState } from "react";
import type { AdminCourse, AdminUserEntry, UserEntryResponse, UsersResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../../api";
import { useAuth } from "../../auth";

interface UsersSectionProps {
  courses: AdminCourse[];
  onChanged: () => Promise<void>;
}

/**
 * Lists all users; admins can move users between courses and promote or demote everyone except themselves.
 * @param {UsersSectionProps} props
 */
export function UsersSection({ courses, onChanged }: UsersSectionProps) {
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

  /** Moves a user to a course, or out of their course for an empty value. */
  async function setCourse(user: AdminUserEntry, courseId: string) {
    const result = await apiRequest<UserEntryResponse>(`/api/admin/users/${user.id}/course`, {
      method: "PUT",
      body: { courseId: courseId || null },
    });
    if (!result.ok) return setError(errorMessage(result.error));
    setError("");
    await Promise.all([reloadUsers(), onChanged()]);
  }

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
          <li key={user.id}>
            <span>
              {user.email}
              {user.role === "admin" && <span className="muted"> · admin</span>}
            </span>
            <div className="actions">
              <select
                aria-label={`Course of ${user.email}`}
                value={user.courseId ?? ""}
                onChange={(event) => setCourse(user, event.target.value)}
              >
                <option value="">No course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
              {user.id !== currentUser?.id && (
                <button type="button" className="secondary" onClick={() => toggleRole(user)}>
                  {user.role === "admin" ? "Remove admin" : "Make admin"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
