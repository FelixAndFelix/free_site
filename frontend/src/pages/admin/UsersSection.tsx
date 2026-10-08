import { useMemo, useState } from "react";
import type { AdminCourse, AdminUserEntry, UserEntryResponse } from "@free-site/shared";
import { apiRequest } from "../../api";
import { useAuth } from "../../auth";
import { errorKey, useI18n } from "../../i18n";

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
  const { t } = useI18n();
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
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    await onChanged();
  }

  /** Switches a user between the user and admin role. */
  async function toggleRole(user: AdminUserEntry) {
    const role = user.role === "admin" ? "user" : "admin";
    const result = await apiRequest(`/api/admin/users/${user.id}`, { method: "PATCH", body: { role } });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    await onChanged();
  }

  const shown = matches.slice(0, visible);

  return (
    <section className="stack" aria-labelledby="users-heading">
      <h2 id="users-heading">{t("admin.usersHeading")}</h2>
      <div className="card users-card">
        <div className="users-toolbar">
          <label className="field users-search">
            <span>{t("admin.search")}</span>
            <input
              type="search"
              placeholder={t("admin.searchPlaceholder")}
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
            <span>{t("admin.courseFilter")}</span>
            <select
              value={courseFilter}
              onChange={(event) => {
                setCourseFilter(event.target.value);
                setVisible(PAGE_SIZE);
              }}
            >
              <option value="">{t("admin.allCourses")}</option>
              <option value={NO_COURSE}>{t("admin.noCourse")}</option>
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
            {t("admin.adminsOnly")}
          </label>
        </div>
        <p className="muted" role="status">
          {matches.length === users.length
            ? t("admin.userCount", { count: users.length })
            : t("admin.matchCount", { matches: matches.length, total: users.length })}
        </p>
        {matches.length === 0 ? (
          <p className="empty-state">{t("admin.noMatch")}</p>
        ) : (
          <table className="data-table users-table">
            <thead>
              <tr>
                <th scope="col">{t("admin.colUser")}</th>
                <th scope="col">{t("admin.colRole")}</th>
                <th scope="col">{t("admin.colCourse")}</th>
                <th scope="col">
                  <span className="visually-hidden">{t("admin.colActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((user) => (
                <tr key={user.id}>
                  <th scope="row">
                    <strong>{user.username ?? t("admin.noUsername")}</strong>
                    <span className="muted user-email">{user.email}</span>
                  </th>
                  <td data-label={t("admin.colRole")}>{user.role === "admin" ? t("admin.roleAdmin") : t("admin.roleUser")}</td>
                  <td data-label={t("admin.colCourse")}>
                    <select
                      aria-label={t("admin.courseOf", { email: user.email })}
                      value={user.courseId ?? ""}
                      onChange={(event) => setCourse(user, event.target.value)}
                    >
                      <option value="">{t("admin.noCourse")}</option>
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
                        {user.role === "admin" ? t("admin.removeAdmin") : t("admin.makeAdmin")}
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
            {t("admin.showMore", { count: Math.min(PAGE_SIZE, matches.length - visible) })}
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
