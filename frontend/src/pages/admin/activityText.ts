import type { AuditEntry } from "@free-site/shared";
import type { MessageKey } from "../../i18n";

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

/**
 * Writes one log entry as a sentence in the page's language: "anna created the course INF24B".
 * An account that has been deleted since shows as "A deleted account".
 * @param {AuditEntry} entry
 * @param {Translate} t
 */
export function describeEntry(entry: AuditEntry, t: Translate): string {
  const actor = entry.actor ?? t("activity.someone");
  const target = entry.target ?? t("activity.someone");
  const label = entry.label ?? "";
  switch (entry.action) {
    case "user.role_changed":
      return t("activity.user.role_changed", { actor, target, label: label === "admin" ? t("admin.roleAdmin") : t("admin.roleUser") });
    case "user.course_changed":
      return entry.label === null
        ? t("activity.user.course_removed", { actor, target })
        : t("activity.user.course_changed", { actor, target, label });
    case "login.failed":
      return entry.target === null ? t("activity.login.failedUnknown") : t("activity.login.failed", { target });
    case "password_reset.requested":
      return entry.target === null
        ? t("activity.password_reset.requestedUnknown")
        : t("activity.password_reset.requested", { target });
    default:
      return t(`activity.${entry.action}`, { actor, target, label });
  }
}
