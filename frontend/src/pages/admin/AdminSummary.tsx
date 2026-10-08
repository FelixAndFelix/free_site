import type { AdminCourse, AdminUserEntry } from "@free-site/shared";
import { useI18n } from "../../i18n";

/**
 * The numbers an admin wants at a glance. People without a course cannot vote, so that count is
 * the one to act on.
 * @param {{courses: AdminCourse[], users: AdminUserEntry[]}} props
 */
export function AdminSummary({ courses, users }: { courses: AdminCourse[]; users: AdminUserEntry[] }) {
  const { t } = useI18n();
  const adminCount = users.filter((user) => user.role === "admin").length;
  const figures = [
    { label: t("admin.courses", { count: courses.length }), value: courses.length },
    { label: t("admin.users", { count: users.length }), value: users.length },
    { label: t("admin.admins", { count: adminCount }), value: adminCount },
    { label: t("admin.withoutCourse"), value: users.filter((user) => user.courseId === null).length },
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
