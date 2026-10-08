import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MAX_SEMESTER, type AdminCourse, type Module, type ModulesResponse } from "@free-site/shared";
import { apiRequest } from "../../api";
import { Field } from "../../Field";
import { errorKey, useI18n } from "../../i18n";

interface ModulesSectionProps {
  course: AdminCourse;
  onChanged: () => Promise<void>;
}

const SEMESTERS = Array.from({ length: MAX_SEMESTER }, (_, index) => index + 1);

/**
 * The modules of one course grouped by semester, shown inside the course's card. Admins can add,
 * rename, move to another semester and delete modules.
 * @param {ModulesSectionProps} props
 */
export function ModulesSection({ course, onChanged }: ModulesSectionProps) {
  const { t } = useI18n();
  const [modules, setModules] = useState<Module[]>([]);
  const [name, setName] = useState("");
  const [semester, setSemester] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSemester, setEditSemester] = useState(1);
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
  }

  /** Saves the new name and semester of the edited module. */
  async function saveEdit(event: FormEvent, module: Module) {
    event.preventDefault();
    const result = await apiRequest(`/api/admin/modules/${module.id}`, {
      method: "PATCH",
      body: { name: editName, semester: editSemester },
    });
    if (!result.ok) return setError(t(errorKey(result.error)));
    setError("");
    setEditingId(null);
    await Promise.all([reloadModules(), onChanged()]);
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
          <h4>{t("common.semester", { number })}</h4>
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
                      <button type="submit">{t("common.save")}</button>
                      <button type="button" className="secondary" onClick={() => setEditingId(null)}>
                        {t("common.cancel")}
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="module-name">{module.name}</span>
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
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
