import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MAX_SEMESTER, type AdminCourse, type Module, type ModulesResponse } from "@free-site/shared";
import { apiRequest, errorMessage } from "../../api";
import { Field } from "../../Field";

interface ModulesSectionProps {
  course: AdminCourse;
  onChanged: () => Promise<void>;
}

const SEMESTERS = Array.from({ length: MAX_SEMESTER }, (_, index) => index + 1);

/**
 * Shows the modules of one course grouped by semester and lets admins add and delete them.
 * @param {ModulesSectionProps} props
 */
export function ModulesSection({ course, onChanged }: ModulesSectionProps) {
  const [modules, setModules] = useState<Module[]>([]);
  const [name, setName] = useState("");
  const [semester, setSemester] = useState(1);
  const [error, setError] = useState("");
  const modulesPath = `/api/admin/courses/${course.id}/modules`;

  const reloadModules = useCallback(async () => {
    const result = await apiRequest<ModulesResponse>(modulesPath);
    if (!result.ok) return setError(errorMessage(result.error));
    setModules(result.data.modules);
  }, [modulesPath]);

  useEffect(() => {
    reloadModules();
  }, [reloadModules]);

  /** Adds a module to the course. */
  async function createModule(event: FormEvent) {
    event.preventDefault();
    const result = await apiRequest(modulesPath, { body: { name, semester } });
    if (!result.ok) return setError(errorMessage(result.error));
    setError("");
    setName("");
    await Promise.all([reloadModules(), onChanged()]);
  }

  /** Deletes a module after confirmation. */
  async function deleteModule(module: Module) {
    if (!window.confirm(`Delete ${module.name}? Its votes are deleted too.`)) return;
    const result = await apiRequest(`/api/admin/modules/${module.id}`, { method: "DELETE" });
    if (!result.ok) return setError(errorMessage(result.error));
    await Promise.all([reloadModules(), onChanged()]);
  }

  const usedSemesters = SEMESTERS.filter((number) => modules.some((module) => module.semester === number));

  return (
    <section className="card">
      <h2>Modules of {course.name}</h2>
      {modules.length === 0 && <p className="muted">No modules yet.</p>}
      {usedSemesters.map((number) => (
        <div key={number}>
          <h3>Semester {number}</h3>
          <ul className="list">
            {modules
              .filter((module) => module.semester === number)
              .map((module) => (
                <li key={module.id} className="row">
                  <span>{module.name}</span>
                  <button type="button" className="danger" onClick={() => deleteModule(module)}>
                    Delete
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
      <form className="inline-form" onSubmit={createModule}>
        <Field label="New module" placeholder="Datenbanken" value={name} onValue={setName} />
        <label className="field">
          <span>Semester</span>
          <select value={semester} onChange={(event) => setSemester(Number(event.target.value))}>
            {SEMESTERS.map((number) => (
              <option key={number} value={number}>
                {number}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Add module</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
