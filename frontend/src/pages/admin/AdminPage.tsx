import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import type { AdminCourse, CoursesResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../../api";
import { CoursesSection } from "./CoursesSection";
import { ModulesSection } from "./ModulesSection";
import { UsersSection } from "./UsersSection";

/** Admin screen: courses with join codes, the modules of one course, and user roles. */
export function AdminPage() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reloadCourses = useCallback(async () => {
    const result = await apiRequest<CoursesResponse>("/api/admin/courses");
    if (!result.ok) return setError(errorMessage(result.error));
    setCourses(result.data.courses);
  }, []);

  useEffect(() => {
    reloadCourses();
  }, [reloadCourses]);

  // A deleted course disappears from the list, which also closes its module section.
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);

  return (
    <div className="stack">
      <header className="page-header">
        <h1>Admin</h1>
        <Link to="/">Back</Link>
      </header>
      {error && <p role="alert">{error}</p>}
      <CoursesSection
        courses={courses}
        selectedCourseId={selectedCourseId}
        onSelect={setSelectedCourseId}
        onChanged={reloadCourses}
      />
      {selectedCourse && <ModulesSection course={selectedCourse} onChanged={reloadCourses} />}
      <UsersSection courses={courses} onChanged={reloadCourses} />
    </div>
  );
}
