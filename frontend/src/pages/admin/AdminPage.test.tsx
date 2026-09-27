import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findLoggedInAs, mockApi, renderAt, sentBodies, type } from "../../testUtils";

const ADMIN = { id: "a1", email: "admin@dhbw.example", username: "felix", role: "admin" };
const COURSE = { id: "c1", name: "INF24B", joinCode: "INF24B-7KQ2XMPA", memberCount: 12, moduleCount: 2 };
const MODULES = [
  { id: "m1", courseId: "c1", name: "Mathematik I", semester: 1 },
  { id: "m2", courseId: "c1", name: "Datenbanken", semester: 3 },
];
const USERS = [
  { id: "a1", email: "admin@dhbw.example", username: "felix", role: "admin", courseName: "INF24B" },
  { id: "u1", email: "student@dhbw.example", username: "student", role: "user", courseName: "INF24B" },
];

/**
 * Mocks the API for a logged-in admin, with extra replies merged in.
 * @param {Record<string, {status: number, body?: object}>} extra
 */
function mockAdminApi(extra: Record<string, { status: number; body?: object }> = {}) {
  return mockApi({
    "GET /api/auth/me": { status: 200, body: { user: ADMIN } },
    "GET /api/admin/courses": { status: 200, body: { courses: [COURSE] } },
    "GET /api/admin/courses/c1/modules": { status: 200, body: { modules: MODULES } },
    "GET /api/admin/users": { status: 200, body: { users: USERS } },
    ...extra,
  });
}

describe("AdminPage", () => {
  beforeEach(() => vi.spyOn(window, "confirm").mockReturnValue(true));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends a user who is not an admin back home", async () => {
    mockApi({ "GET /api/auth/me": { status: 200, body: { user: { ...ADMIN, role: "user" } } } });
    renderAt("/admin");
    expect(await findLoggedInAs("felix")).toBeInTheDocument();
  });

  it("shows the courses with their join codes", async () => {
    mockAdminApi();
    renderAt("/admin");
    expect(await screen.findByText("INF24B-7KQ2XMPA")).toBeInTheDocument();
    expect(screen.getByText(/12 members · 2 modules/)).toBeInTheDocument();
  });

  it("creates a course", async () => {
    const fetchMock = mockAdminApi({ "POST /api/admin/courses": { status: 201, body: { course: COURSE } } });
    renderAt("/admin");

    await screen.findByText("INF24B-7KQ2XMPA");
    type(/New course/, "INF25A");
    fireEvent.click(screen.getByRole("button", { name: "Create course" }));

    expect(await screen.findByRole("heading", { name: "Modules of INF24B" })).toBeInTheDocument();
    expect(sentBodies(fetchMock, "POST", "/api/admin/courses")).toEqual([{ name: "INF25A" }]);
  });

  it("explains a duplicate course name", async () => {
    mockAdminApi({ "POST /api/admin/courses": { status: 409, body: { error: "course_exists" } } });
    renderAt("/admin");

    await screen.findByText("INF24B-7KQ2XMPA");
    type(/New course/, "INF24B");
    fireEvent.click(screen.getByRole("button", { name: "Create course" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A course with this name already exists.");
  });

  it("rotates a join code after confirmation", async () => {
    const fetchMock = mockAdminApi({ "POST /api/admin/courses/c1/join-code": { status: 200, body: { course: COURSE } } });
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "New join code" }));

    await vi.waitFor(() => expect(sentBodies(fetchMock, "POST", "/api/admin/courses/c1/join-code")).toHaveLength(1));
    expect(window.confirm).toHaveBeenCalled();
  });

  it("shows the modules of a course grouped by semester and adds one", async () => {
    const fetchMock = mockAdminApi({
      "POST /api/admin/courses/c1/modules": { status: 201, body: { module: MODULES[0] } },
    });
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Manage modules" }));
    expect(await screen.findByRole("heading", { name: "Semester 3" })).toBeInTheDocument();
    expect(screen.getByText("Datenbanken")).toBeInTheDocument();

    type(/New module/, "Programmieren");
    fireEvent.change(screen.getByLabelText("Semester"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add module" }));

    await vi.waitFor(() =>
      expect(sentBodies(fetchMock, "POST", "/api/admin/courses/c1/modules")).toEqual([
        { name: "Programmieren", semester: 2 },
      ]),
    );
  });

  it("deletes a module after confirmation", async () => {
    const fetchMock = mockAdminApi({ "DELETE /api/admin/modules/m2": { status: 204 } });
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Manage modules" }));
    const row = (await screen.findByText("Datenbanken")).closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    await vi.waitFor(() => expect(sentBodies(fetchMock, "DELETE", "/api/admin/modules/m2")).toHaveLength(1));
  });

  it("promotes another user but offers no button for yourself", async () => {
    const fetchMock = mockAdminApi({ "PATCH /api/admin/users/u1": { status: 200, body: { user: USERS[1] } } });
    renderAt("/admin");

    const ownRow = (await screen.findByText("admin@dhbw.example")).closest("li")!;
    expect(within(ownRow).queryByRole("button")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Make admin" }));
    await vi.waitFor(() => expect(sentBodies(fetchMock, "PATCH", "/api/admin/users/u1")).toEqual([{ role: "admin" }]));
  });
});
