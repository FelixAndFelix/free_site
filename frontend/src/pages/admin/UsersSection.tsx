import { useMemo, useState } from "react";
import type { AdminCourse, AdminUserEntry, UserEntryResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../../api";
import { useAuth } from "../../auth";

interface UsersSectionProps {
  users: AdminUserEntry[];
  courses: AdminCourse[];
  onChanged: () => Promise<void>;
}

const PAGE_SIZE = 20;
const NO_COURSE = "none";

/**
 * All users as a searchable table. Admins can filter by course and role, move users between
 * courses and promote or demote everyone except themselves.
 * @param {UsersSectionProps} props
 */
export function UsersSection({ users, courses, onChanged }: UsersSectionProps) {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [error, setError] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (adminsOnly && user.role !== "admin") return false;
      if (courseFilter === NO_COURSE && user.courseId !== null) return false;
      if (courseFilter && courseFilter !== NO_COURSE && user.courseId !== courseFilter) return false;
      return !needle || `${user.username ?? ""} ${user.email}`.toLowerCase().includes(needle);
    });
  }, [users, query, courseFilter, adminsOnly]);

  /** Moves a user to a course, or out of their course for an empty value. */
  async function setCourse(user: AdminUserEntry, courseId: string) {
    const result = await apiRequest<UserEntryResponse>(`/api/admin/users/${user.id}/course`, {
      method: "PUT",
      body: { courseId: courseId || null },
    });
    if (!result.ok) return setError(errorMessage(result.error));
    setError("");
    await onChanged();
  }

  /** Switches a user between the user and admin role. */
  async function toggleRole(user: AdminUserEntry) {
    const role = user.role === "admin" ? "user" : "admin";
    const result = await apiRequest(`/api/admin/users/${user.id}`, { method: "PATCH", body: { role } });
    if (!result.ok) return setError(errorMessage(result.error));
    setError("");
    await onChanged();
  }

  const shown = matches.slice(0, visible);

  return (
    <section className="stack" aria-labelledby="users-heading">
      <h2 id="users-heading">Users</h2>
      <div className="card users-card">
        <div className="users-toolbar">
          <label className="field users-search">
            <span>Search users</span>
            <input
              type="search"
              placeholder="Username or email"
              value={query}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisible(PAGE_SIZE);
              }}
            />
          </label>
          <label className="field">
            <span>Course</span>
            <select
              value={courseFilter}
              onChange={(event) => {
                setCourseFilter(event.target.value);
                setVisible(PAGE_SIZE);
              }}
            >
              <option value="">All courses</option>
              <option value={NO_COURSE}>No course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox users-admins">
            <input
              type="checkbox"
              checked={adminsOnly}
              onChange={(event) => {
                setAdminsOnly(event.target.checked);
                setVisible(PAGE_SIZE);
              }}
            />
            Admins only
          </label>
        </div>
        <p className="muted" role="status">
          {matches.length === users.length
            ? `${users.length} ${users.length === 1 ? "user" : "users"}`
            : `${matches.length} of ${users.length} users match`}
        </p>
        {matches.length === 0 ? (
          <p className="empty-state">No users match. Change the search or the filters.</p>
        ) : (
          <table className="data-table users-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Role</th>
                <th scope="col">Course</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((user) => (
                <tr key={user.id}>
                  <th scope="row">
                    <strong>{user.username ?? "(no username yet)"}</strong>
                    <span className="muted user-email">{user.email}</span>
                  </th>
                  <td data-label="Role">{user.role === "admin" ? "Admin" : "User"}</td>
                  <td data-label="Course">
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
                  </td>
                  <td className="users-actions">
                    {user.id !== currentUser?.id && (
                      <button type="button" className="secondary" onClick={() => toggleRole(user)}>
                        {user.role === "admin" ? "Remove admin" : "Make admin"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {matches.length > visible && (
          <button type="button" className="secondary" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, matches.length - visible)} more
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
