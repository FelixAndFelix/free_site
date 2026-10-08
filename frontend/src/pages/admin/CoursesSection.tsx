import { useState, type FormEvent } from "react";
import { CaretDown, CaretUp, Copy, PencilSimple } from "@phosphor-icons/react";
import type { AdminCourse, CourseResponse } from "@free-site/shared";
import { apiRequest } from "../../api";
import { Field } from "../../Field";
import { errorKey, useI18n } from "../../i18n";
import { ModulesSection } from "./ModulesSection";

interface CoursesSectionProps {
  courses: AdminCourse[];
  onChanged: () => Promise<void>;
}

/**
 * Lists the courses as cards with invite link, members and an expandable module list, and lets
 * admins create, rename and delete courses and replace join codes. Several cards can be open at once.
 * @param {CoursesSectionProps} props
 */
export function CoursesSection({ courses, onChanged }: CoursesSectionProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [openCourseIds, setOpenCourseIds] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [copiedCourseId, setCopiedCourseId] = useState<string | null>(null);

  /** Creates a course and opens its module list. */
  async function createCourse(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest<CourseResponse>("/api/admin/courses", { body: { name } });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    setName("");
    await onChanged();
    setOpenCourseIds((ids) => [...ids, result.data.course.id]);
  }

  /** Opens or closes the module list of a course. */
  function toggleModules(courseId: string) {
    setOpenCourseIds((ids) => (ids.includes(courseId) ? ids.filter((id) => id !== courseId) : [...ids, courseId]));
  }

  /** Starts renaming a course with its current name in the field. */
  function startRename(course: AdminCourse) {
    setRenamingId(course.id);
    setNewName(course.name);
  }

  /** Saves the new course name. The join code stays, so shared links keep working. */
  async function renameCourse(event: FormEvent, course: AdminCourse) {
    event.preventDefault();
    const result = await apiRequest(`/api/admin/courses/${course.id}`, { method: "PATCH", body: { name: newName } });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    setRenamingId(null);
    await onChanged();
  }

  /** Deletes an empty course and its modules after confirmation. */
  async function deleteCourse(course: AdminCourse) {
    if (!window.confirm(t("admin.confirmDeleteCourse", { name: course.name, modules: t("admin.modules", { count: course.moduleCount }) }))) return;
    const result = await apiRequest(`/api/admin/courses/${course.id}`, { method: "DELETE" });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    setOpenCourseIds((ids) => ids.filter((id) => id !== course.id));
    await onChanged();
  }

  /** Copies the invite link of a course (this site's address plus the join code) to the clipboard. */
  async function copyInviteLink(course: AdminCourse) {
    const link = inviteLink(course);
    try {
      await navigator.clipboard.writeText(link);
      setError("");
      setCopiedCourseId(course.id);
    } catch {
      setError(t("admin.copyFailed", { link }));
    }
  }

  /** Replaces the join code of a course after confirmation. */
  async function rotateJoinCode(course: AdminCourse) {
    if (!window.confirm(t("admin.confirmNewCode", { name: course.name }))) return;
    const result = await apiRequest(`/api/admin/courses/${course.id}/join-code`, { method: "POST" });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setCopiedCourseId(null);
    await onChanged();
  }

  return (
    <section className="stack" aria-labelledby="courses-heading">
      <h2 id="courses-heading">{t("admin.coursesHeading")}</h2>
      {courses.length === 0 && <p className="empty-state">{t("admin.noCourses")}</p>}
      <ul className="course-list">
        {courses.map((course) => {
          const open = openCourseIds.includes(course.id);
          return (
            <li key={course.id} className="card course-card">
              <div className="course-head">
                {renamingId === course.id ? (
                  <form className="rename-form" onSubmit={(event) => renameCourse(event, course)}>
                    <input aria-label={t("admin.courseNameOf", { name: course.name })} value={newName} onChange={(event) => setNewName(event.target.value)} required />
                    <button type="submit">{t("common.save")}</button>
                    <button type="button" className="secondary" onClick={() => setRenamingId(null)}>
                      {t("common.cancel")}
                    </button>
                  </form>
                ) : (
                  <>
                    <div>
                      <h3>{course.name}</h3>
                      <p className="muted">
                        {t("admin.members", { count: course.memberCount })}, {t("admin.modules", { count: course.moduleCount })}
                      </p>
                    </div>
                    <button type="button" className="icon-button" onClick={() => startRename(course)}>
                      <PencilSimple aria-hidden="true" />
                      <span className="visually-hidden">{t("admin.rename", { name: course.name })}</span>
                    </button>
                  </>
                )}
              </div>
              <div className="actions">
                <button type="button" className="secondary" onClick={() => copyInviteLink(course)}>
                  <Copy aria-hidden="true" />
                  <span>{copiedCourseId === course.id ? t("admin.linkCopied") : t("admin.copyLink")}</span>
                </button>
                <button
                  type="button"
                  className="secondary"
                  aria-expanded={open}
                  aria-controls={`modules-${course.id}`}
                  onClick={() => toggleModules(course.id)}
                >
                  {open ? <CaretUp aria-hidden="true" /> : <CaretDown aria-hidden="true" />}
                  <span>{open ? t("admin.hideModules") : t("admin.showModules")}</span>
                </button>
                <button type="button" className="secondary" onClick={() => rotateJoinCode(course)}>
                  {t("admin.newJoinCode")}
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={course.memberCount > 0}
                  onClick={() => deleteCourse(course)}
                >
                  {t("common.delete")}
                </button>
              </div>
              {course.memberCount > 0 && (
                <p className="muted hint">{t("admin.deleteHint")}</p>
              )}
              {open && (
                <div id={`modules-${course.id}`} className="modules-panel">
                  <ModulesSection course={course} onChanged={onChanged} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <form className="card" onSubmit={createCourse}>
        <h3>{t("admin.newCourse")}</h3>
        <div className="inline-form">
          <Field label={t("admin.courseName")} placeholder="INF25A" value={name} onValue={setName} />
          <button type="submit">{t("admin.createCourse")}</button>
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

/**
 * The link admins share with a class: this site's address plus the course's join code.
 * @param {AdminCourse} course
 */
function inviteLink(course: AdminCourse): string {
  return `${window.location.origin}/join/${course.joinCode}`;
}
