import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUDIT_ACTIONS_BY_CATEGORY,
  AUDIT_CATEGORIES,
  AUDIT_RANGES,
  AUDIT_SEARCH_MAX_LENGTH,
  isAuditAction,
  isAuditRange,
  type ApiErrorCode,
  type AuditAction,
  type AuditCategory,
  type AuditEntry,
  type AuditRange,
  type AuditResponse,
} from "@free-site/shared";
import { apiRequest } from "../../api";
import { BackLink } from "../../BackLink";
import { errorKey, useI18n } from "../../i18n";
import { useDebouncedValue } from "../../useDebouncedValue";
import { describeEntry } from "./activityText";

const TAB_LABELS = { audit: "activity.tabAudit", access: "activity.tabAccess" } as const;
const RETENTION = { audit: "activity.retentionAudit", access: "activity.retentionAccess" } as const;
const RANGE_LABELS = { "24h": "activity.last24h", "7d": "activity.last7d", "30d": "activity.last30d" } as const;
// Long enough that typing a whole address sends one request, short enough to feel immediate.
const SEARCH_DELAY_MS = 300;

/**
 * The activity log for admins: what admins changed, and who signed in or out of accounts, with the
 * email address and IP address of each entry. Newest first, older entries on request. Searching and
 * the filters for kind of event and time run on the server, so they cover the whole log; clicking an
 * email or IP address in a row searches for it.
 */
export function ActivityPage() {
  const { t, locale } = useI18n();
  const [category, setCategory] = useState<AuditCategory>("audit");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<AuditAction | "">("");
  const [range, setRange] = useState<AuditRange | "">("");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const searchText = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);
  // Only the newest request may fill the table, so a slow earlier answer cannot overwrite a newer one.
  const latestRequest = useRef(0);

  /** Loads a page with the current filters; without a cursor it starts again from the newest entry. */
  const load = useCallback(
    async (cursor?: string) => {
      const query = new URLSearchParams({ category });
      if (searchText) query.set("q", searchText);
      if (action) query.set("action", action);
      if (range) query.set("range", range);
      if (cursor) query.set("cursor", cursor);
      const request = ++latestRequest.current;
      const result = await apiRequest<AuditResponse>(`/api/admin/audit?${query}`);
      if (request !== latestRequest.current) return;
      if (!result.ok) return setError(result.error);
      setError(null);
      setEntries((current) => (cursor ? [...current, ...result.data.entries] : result.data.entries));
      setNextCursor(result.data.nextCursor);
      setLoaded(true);
    },
    [category, searchText, action, range],
  );

  useEffect(() => {
    setLoaded(false);
    load();
  }, [load]);

  const time = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" });
  const filtered = search !== "" || action !== "" || range !== "";

  /** Switches the log; the kinds of event differ between the two, so that filter starts over. */
  function chooseCategory(next: AuditCategory) {
    setCategory(next);
    setAction("");
  }

  /** Clears the search, the event and the time range. */
  function clearFilters() {
    setSearch("");
    setAction("");
    setRange("");
  }

  /** A value in a row (an email or IP address) that searches for itself when clicked. */
  function filterValue(value: string, code = false) {
    const text = code ? <code>{value}</code> : value;
    return (
      <button
        type="button"
        className="log-filter"
        title={t("activity.filterBy", { value })}
        onClick={() => setSearch(value)}
      >
        {text}
      </button>
    );
  }

  return (
    <div className="stack-lg">
      <header className="page-intro">
        <BackLink to="/admin">{t("admin.title")}</BackLink>
        <h1>{t("activity.title")}</h1>
      </header>
      <section className="stack" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="visually-hidden">
          {t(TAB_LABELS[category])}
        </h2>
        <div className="card activity-card">
          <div className="tabs" role="group" aria-label={t("activity.title")}>
            {AUDIT_CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                className="tab"
                aria-pressed={option === category}
                onClick={() => chooseCategory(option)}
              >
                {t(TAB_LABELS[option])}
              </button>
            ))}
          </div>
          <p className="muted">{t(RETENTION[category])}</p>

          <div className="log-filters">
            <label className="field log-search">
              <span>{t("activity.search")}</span>
              <input
                type="search"
                value={search}
                placeholder={t("activity.searchPlaceholder")}
                maxLength={AUDIT_SEARCH_MAX_LENGTH}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="field">
              <span>{t("activity.filterEvent")}</span>
              <select value={action} onChange={(event) => setAction(isAuditAction(event.target.value) ? event.target.value : "")}>
                <option value="">{t("activity.allEvents")}</option>
                {AUDIT_ACTIONS_BY_CATEGORY[category].map((option) => (
                  <option key={option} value={option}>
                    {t(`activity.filter.${option}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("activity.filterTime")}</span>
              <select value={range} onChange={(event) => setRange(isAuditRange(event.target.value) ? event.target.value : "")}>
                <option value="">{t("activity.allTime")}</option>
                {AUDIT_RANGES.map((option) => (
                  <option key={option} value={option}>
                    {t(RANGE_LABELS[option])}
                  </option>
                ))}
              </select>
            </label>
            {filtered && (
              <button type="button" className="secondary log-clear" onClick={clearFilters}>
                {t("activity.clearFilters")}
              </button>
            )}
          </div>

          {error && <p role="alert">{t(errorKey(error))}</p>}
          {!loaded && !error && (
            <p className="muted" role="status">
              {t("common.loading")}
            </p>
          )}
          {loaded && entries.length === 0 && (
            <p className="empty-state">{filtered ? t("activity.noMatch") : t("activity.empty")}</p>
          )}
          {loaded && entries.length > 0 && (
            <p className="muted" role="status">
              {t("activity.shown", { count: entries.length })}
              {nextCursor ? ` ${t("activity.moreAvailable")}` : ""}
            </p>
          )}
          {entries.length > 0 && (
            <table className="data-table activity-table">
              <thead>
                <tr>
                  <th scope="col">{t("activity.colTime")}</th>
                  <th scope="col">{t("activity.colWhat")}</th>
                  <th scope="col">{t("activity.colEmail")}</th>
                  <th scope="col">{t("activity.colIp")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const emails = [...new Set([entry.actorEmail, entry.email].filter((email): email is string => !!email))];
                  return (
                    <tr key={entry.id}>
                      <td data-label={t("activity.colTime")}>
                        <time dateTime={entry.createdAt}>{time.format(new Date(entry.createdAt))}</time>
                      </td>
                      <th scope="row">{describeEntry(entry, t)}</th>
                      <td data-label={t("activity.colEmail")}>
                        {emails.map((email) => (
                          <span key={email} className="log-line">
                            {filterValue(email)}
                          </span>
                        ))}
                      </td>
                      <td data-label={t("activity.colIp")}>
                        {entry.ip && <span className="log-line">{filterValue(entry.ip, true)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {nextCursor && (
            <button type="button" className="secondary" onClick={() => load(nextCursor)}>
              {t("activity.showMore")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
