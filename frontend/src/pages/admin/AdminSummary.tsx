import type { AdminCourse, AdminUserEntry } from "@free-site/shared";

/**
 * The numbers an admin wants at a glance. People without a course cannot vote, so that count is
 * the one to act on.
 * @param {{courses: AdminCourse[], users: AdminUserEntry[]}} props
 */
export function AdminSummary({ courses, users }: { courses: AdminCourse[]; users: AdminUserEntry[] }) {
  const adminCount = users.filter((user) => user.role === "admin").length;
  const figures = [
    { label: courses.length === 1 ? "Course" : "Courses", value: courses.length },
    { label: users.length === 1 ? "User" : "Users", value: users.length },
    { label: adminCount === 1 ? "Admin" : "Admins", value: adminCount },
    { label: "Without a course", value: users.filter((user) => user.courseId === null).length },
  ];
  return (
    <dl className="card summary">
      {figures.map(({ label, value }) => (
        <div key={label} className="summary-item">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
