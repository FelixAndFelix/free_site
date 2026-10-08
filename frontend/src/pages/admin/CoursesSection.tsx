import { useState, type FormEvent } from "react";
import type { AdminCourse, CourseResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../../api";
import { Field } from "../../Field";

interface CoursesSectionProps {
  courses: AdminCourse[];
  selectedCourseId: string | null;
  onSelect: (courseId: string) => void;
  onChanged: () => Promise<void>;
}

/**
 * Lists the courses with their join codes and lets admins create courses and rotate codes.
 * @param {CoursesSectionProps} props
 */
export function CoursesSection({ courses, selectedCourseId, onSelect, onChanged }: CoursesSectionProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [copiedCourseId, setCopiedCourseId] = useState<string | null>(null);

  /** Creates a course and selects it. */
  async function createCourse(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest<CourseResponse>("/api/admin/courses", { body: { name } });
    if (!result.ok) return setError(errorMessage(result.error));
    setError("");
    setName("");
    await onChanged();
    onSelect(result.data.course.id);
  }

  /** Deletes an empty course and its modules after confirmation. */
  async function deleteCourse(course: AdminCourse) {
    if (!window.confirm(`Delete ${course.name} and its ${count(course.moduleCount, "module")}?`)) return;
    const result = await apiRequest(`/api/admin/courses/${course.id}`, { method: "DELETE" });
    if (!result.ok) return setError(errorMessage(result.error));
    setError("");
    await onChanged();
  }

  /** Copies the invite link of a course (this site's address plus the join code) to the clipboard. */
  async function copyInviteLink(course: AdminCourse) {
    const link = `${window.location.origin}/join/${course.joinCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setError("");
      setCopiedCourseId(course.id);
    } catch {
      setError(`Copying is not possible here. The invite link is ${link}`);
    }
  }

  /** Replaces the join code of a course after confirmation. */
  async function rotateJoinCode(course: AdminCourse) {
    if (!window.confirm(`Replace the join code of ${course.name}? The old code and invite link stop working immediately.`)) return;
    const result = await apiRequest(`/api/admin/courses/${course.id}/join-code`, { method: "POST" });
    if (!result.ok) return setError(errorMessage(result.error));
    await onChanged();
  }

  return (
    <section className="card">
      <h2>Courses</h2>
      <ul className="list">
        {courses.map((course) => (
          <li key={course.id} className={course.id === selectedCourseId ? "selected" : undefined}>
            <div>
              <strong>{course.name}</strong>
              <span className="muted">
                {" "}
                · {count(course.memberCount, "member")} · {count(course.moduleCount, "module")}
              </span>
            </div>
            <div>
              Join code: <code>{course.joinCode}</code>
            </div>
            <div className="actions">
              <button type="button" className="secondary" onClick={() => onSelect(course.id)}>
                Manage modules
              </button>
              <button type="button" className="secondary" onClick={() => copyInviteLink(course)}>
                {copiedCourseId === course.id ? "Link copied" : "Copy invite link"}
              </button>
              <button type="button" className="secondary" onClick={() => rotateJoinCode(course)}>
                New join code
              </button>
              <button
                type="button"
                className="danger"
                disabled={course.memberCount > 0}
                onClick={() => deleteCourse(course)}
              >
                Delete
              </button>
            </div>
            {course.memberCount > 0 && (
              <span className="muted">To delete this course, first move or remove its members under Users.</span>
            )}
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={createCourse}>
        <Field label="New course" placeholder="INF25A" value={name} onValue={setName} />
        <button type="submit">Create course</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

/**
 * Formats a count with a singular or plural noun, e.g. "1 member" or "12 members".
 * @param {number} amount
 * @param {string} noun
 */
function count(amount: number, noun: string): string {
  return `${amount} ${noun}${amount === 1 ? "" : "s"}`;
}
