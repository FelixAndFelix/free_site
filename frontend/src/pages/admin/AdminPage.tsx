import { useCallback, useEffect, useState } from "react";
import type { AdminCourse, AdminUserEntry, CoursesResponse, UsersResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../../api";
import { BackLink } from "../../BackLink";
import { CoursesSection } from "./CoursesSection";
import { AdminSummary } from "./AdminSummary";
import { UsersSection } from "./UsersSection";

/** Admin screen: a summary, the courses with their invite links and modules, and the users. */
export function AdminPage() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [users, setUsers] = useState<AdminUserEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const reloadCourses = useCallback(async () => {
    const result = await apiRequest<CoursesResponse>("/api/admin/courses");
    if (!result.ok) return setError(errorMessage(result.error));
    setCourses(result.data.courses);
  }, []);

  const reloadUsers = useCallback(async () => {
    const result = await apiRequest<UsersResponse>("/api/admin/users");
    if (!result.ok) return setError(errorMessage(result.error));
    setUsers(result.data.users);
  }, []);

  /** Reloads both lists, because moving a user changes the member counts of courses. */
  const reloadAll = useCallback(async () => {
    await Promise.all([reloadCourses(), reloadUsers()]);
  }, [reloadCourses, reloadUsers]);

  useEffect(() => {
    reloadAll().then(() => setLoaded(true));
  }, [reloadAll]);

  return (
    <div className="stack-lg">
      <header className="page-intro">
        <BackLink to="/">All modules</BackLink>
        <h1>Admin</h1>
      </header>
      {error && <p role="alert">{error}</p>}
      {loaded && <AdminSummary courses={courses} users={users} />}
      <CoursesSection courses={courses} onChanged={reloadCourses} />
      <UsersSection users={users} courses={courses} onChanged={reloadAll} />
    </div>
  );
}
