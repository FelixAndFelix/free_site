import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MAX_SEMESTER, type AdminCourse, type CloseSemesterResponse, type Module, type ModulesResponse } from "@free-site/shared";
import { apiRequest } from "../../api";
import { Field } from "../../Field";
import { errorKey, useI18n } from "../../i18n";

interface ModulesSectionProps {
  course: AdminCourse;
  onChanged: () => Promise<void>;
}

const SEMESTERS = Array.from({ length: MAX_SEMESTER }, (_, index) => index + 1);

/**
 * Whether voting on the module has ended.
 * @param {Module} module
 */
function isClosed(module: Module): boolean {
  return !!module.votingEndsAt && new Date(module.votingEndsAt) <= new Date();
}

/**
 * Formats an ISO time for a datetime-local input, in the browser's time zone.
 * @param {string} iso
 */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * The modules of one course grouped by semester, shown inside the course's card. Admins can add,
 * rename, move to another semester and delete modules.
 * @param {ModulesSectionProps} props
 */
export function ModulesSection({ course, onChanged }: ModulesSectionProps) {
  const { t, locale } = useI18n();
  const [modules, setModules] = useState<Module[]>([]);
  const [name, setName] = useState("");
  const [semester, setSemester] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSemester, setEditSemester] = useState(1);
  const [editDeadline, setEditDeadline] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const modulesPath = `/api/admin/courses/${course.id}/modules`;

  const reloadModules = useCallback(async () => {
    const result = await apiRequest<ModulesResponse>(modulesPath);
    if (!result.ok) return setError(t(errorKey(result.error)));
    setModules(result.data.modules);
  }, [modulesPath]);

  useEffect(() => {
    reloadModules();
  }, [reloadModules]);

  /** Adds a module to the course. */
  async function createModule(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest(modulesPath, { body: { name, semester } });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    setName("");
    await Promise.all([reloadModules(), onChanged()]);
  }

  /** Starts editing a module with its current values in the fields. */
  function startEdit(module: Module) {
    setEditingId(module.id);
    setEditName(module.name);
    setEditSemester(module.semester);
    setEditDeadline(module.votingEndsAt ? toLocalInput(module.votingEndsAt) : "");
  }

  /** Saves the new name and semester of the edited module. */
  async function saveEdit(event: FormEvent, module: Module) {
    event.preventDefault();
    const result = await apiRequest(`/api/admin/modules/${module.id}`, {
      method: "PATCH",
      body: {
        name: editName,
        semester: editSemester,
        votingEndsAt: editDeadline ? new Date(editDeadline).toISOString() : null,
      },
    });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    setEditingId(null);
    await Promise.all([reloadModules(), onChanged()]);
  }

  /** Ends voting now on the open modules of one semester, after confirmation. */
  async function closeSemester(number: number) {
    if (!window.confirm(t("admin.confirmCloseSemester", { number }))) return;
    const result = await apiRequest<CloseSemesterResponse>(`/api/admin/courses/${course.id}/close-semester`, {
      body: { semester: number },
    });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    setNotice(t("admin.semesterClosed", { count: result.data.closed }));
    await Promise.all([reloadModules(), onChanged()]);
  }

  /** Describes when voting on a module ends, or that it stays open. */
  function votingText(module: Module): string {
    if (!module.votingEndsAt) return t("admin.votingOpen");
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(module.votingEndsAt));
    return t(new Date(module.votingEndsAt) <= new Date() ? "admin.votingClosedOn" : "admin.votingOpenUntil", { date });
  }

  /** Deletes a module after confirmation. */
  async function deleteModule(module: Module) {
    if (!window.confirm(t("admin.confirmDeleteModule", { name: module.name }))) return;
    const result = await apiRequest(`/api/admin/modules/${module.id}`, { method: "DELETE" });
    if (!result.ok) return setError(t(errorKey(result.error)));
    await Promise.all([reloadModules(), onChanged()]);
  }

  const usedSemesters = SEMESTERS.filter((number) => modules.some((module) => module.semester === number));

  return (
    <div className="modules">
      {modules.length === 0 && <p className="muted">{t("admin.noModules")}</p>}
      {usedSemesters.map((number) => (
        <div key={number} className="modules-semester">
          <div className="modules-semester-head">
            <h4>{t("common.semester", { number })}</h4>
            {modules.some((module) => module.semester === number && !isClosed(module)) && (
              <button type="button" className="secondary" onClick={() => closeSemester(number)}>
                {t("admin.closeSemester", { number })}
              </button>
            )}
          </div>
          <ul className="list">
            {modules
              .filter((module) => module.semester === number)
              .map((module) => (
                <li key={module.id} className="row">
                  {editingId === module.id ? (
                    <form className="rename-form" onSubmit={(event) => saveEdit(event, module)}>
                      <input aria-label={t("admin.moduleName")} value={editName} onChange={(event) => setEditName(event.target.value)} required />
                      <select
                        aria-label={t("admin.moduleSemester")}
                        value={editSemester}
                        onChange={(event) => setEditSemester(Number(event.target.value))}
                      >
                        {SEMESTERS.map((option) => (
                          <option key={option} value={option}>
                            {t("common.semester", { number: option })}
                          </option>
                        ))}
                      </select>
                      <label className="field">
                        <span>{t("admin.votingEnds")}</span>
                        <input type="datetime-local" value={editDeadline} onChange={(event) => setEditDeadline(event.target.value)} />
                        <small className="muted">{t("admin.votingEndsHint")}</small>
                      </label>
                      <button type="submit">{t("common.save")}</button>
                      <button type="button" className="secondary" onClick={() => setEditingId(null)}>
                        {t("common.cancel")}
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="module-name">{module.name}</span>
                      <span className="muted">{votingText(module)}</span>
                      <span className="actions">
                        <button type="button" className="secondary" onClick={() => startEdit(module)}>
                          {t("common.edit")}
                        </button>
                        <button type="button" className="danger" onClick={() => deleteModule(module)}>
                          {t("common.delete")}
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
      <form className="inline-form" onSubmit={createModule}>
        <Field label={t("admin.newModule")} placeholder="Datenbanken" value={name} onValue={setName} />
        <label className="field">
          <span>{t("admin.semester")}</span>
          <select value={semester} onChange={(event) => setSemester(Number(event.target.value))}>
            {SEMESTERS.map((number) => (
              <option key={number} value={number}>
                {number}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">{t("admin.addModule")}</button>
      </form>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
