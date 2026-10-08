import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findLoggedInAs, mockApi, renderAt, sentBodies, type } from "../../testUtils";

const ADMIN = { id: "a1", email: "admin@dhbw.example", username: "felix", role: "admin" };
const COURSE = { id: "c1", name: "INF24B", joinCode: "INF24B-7KQ2XMPA", memberCount: 12, moduleCount: 2 };
const MODULES = [
  { id: "m1", courseId: "c1", name: "Mathematik I", semester: 1, votingEndsAt: null },
  { id: "m2", courseId: "c1", name: "Datenbanken", semester: 3, votingEndsAt: null },
];
const USERS = [
  { id: "a1", email: "admin@dhbw.example", username: "felix", role: "admin", courseId: "c1", courseName: "INF24B" },
  { id: "u1", email: "student@dhbw.example", username: "student", role: "user", courseId: "c1", courseName: "INF24B" },
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

  it("shows the courses with their counts but not the invite link itself", async () => {
    mockAdminApi();
    renderAt("/admin");
    expect(await screen.findByText("12 members, 2 modules")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy invite link" })).toBeInTheDocument();
    expect(screen.queryByText(/INF24B-7KQ2XMPA/)).not.toBeInTheDocument();
  });

  it("creates a course", async () => {
    const fetchMock = mockAdminApi({ "POST /api/admin/courses": { status: 201, body: { course: COURSE } } });
    renderAt("/admin");

    await screen.findByRole("heading", { name: "INF24B" });
    type(/Course name/, "INF25A");
    fireEvent.click(screen.getByRole("button", { name: "Create course" }));

    // The new course opens its module list right away, so modules can be added without another click.
    expect(await screen.findByRole("button", { name: "Hide modules" })).toBeInTheDocument();
    expect(sentBodies(fetchMock, "POST", "/api/admin/courses")).toEqual([{ name: "INF25A" }]);
  });

  it("explains a duplicate course name", async () => {
    mockAdminApi({ "POST /api/admin/courses": { status: 409, body: { error: "course_exists" } } });
    renderAt("/admin");

    await screen.findByRole("heading", { name: "INF24B" });
    type(/Course name/, "INF24B");
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

  it("copies the invite link of a course", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    mockAdminApi();
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Copy invite link" }));

    expect(await screen.findByRole("button", { name: "Link copied" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/INF24B-7KQ2XMPA`);
  });

  it("shows the link when the clipboard is not available", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    mockAdminApi();
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Copy invite link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("/join/INF24B-7KQ2XMPA");
  });

  it("shows numbers at a glance", async () => {
    mockAdminApi({
      "GET /api/admin/users": {
        status: 200,
        body: { users: [...USERS, { id: "u2", email: "new@dhbw.example", username: "new", role: "user", courseId: null, courseName: null }] },
      },
    });
    renderAt("/admin");

    const summary = (await screen.findByText("Without a course")).closest("dl")!;
    expect(summary).toHaveTextContent("Course1");
    expect(summary).toHaveTextContent("Users3");
    expect(summary).toHaveTextContent("Admin1");
    expect(summary).toHaveTextContent("Without a course1");
  });

  it("opens and closes the modules of a course with the same button", async () => {
    mockAdminApi();
    renderAt("/admin");

    const toggle = await screen.findByRole("button", { name: "Manage modules" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(await screen.findByText("Datenbanken")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide modules" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide modules" }));
    expect(screen.queryByText("Datenbanken")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage modules" })).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps several courses open at once", async () => {
    const other = { ...COURSE, id: "c2", name: "INF25A", joinCode: "INF25A-AAAAAAAA", memberCount: 0, moduleCount: 0 };
    mockAdminApi({
      "GET /api/admin/courses": { status: 200, body: { courses: [COURSE, other] } },
      "GET /api/admin/courses/c2/modules": { status: 200, body: { modules: [] } },
    });
    renderAt("/admin");

    const buttons = await screen.findAllByRole("button", { name: "Manage modules" });
    fireEvent.click(buttons[0]!);
    fireEvent.click(buttons[1]!);

    expect(await screen.findByText("Datenbanken")).toBeInTheDocument();
    expect(await screen.findByText(/No modules yet/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Hide modules" })).toHaveLength(2);
  });

  it("renames a course", async () => {
    const fetchMock = mockAdminApi({ "PATCH /api/admin/courses/c1": { status: 200, body: { course: COURSE } } });
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Rename INF24B" }));
    fireEvent.change(screen.getByLabelText("Name of INF24B"), { target: { value: "INF24B neu" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => expect(sentBodies(fetchMock, "PATCH", "/api/admin/courses/c1")).toEqual([{ name: "INF24B neu" }]));
  });

  it("edits the name and semester of a module", async () => {
    const fetchMock = mockAdminApi({ "PATCH /api/admin/modules/m2": { status: 200, body: { module: MODULES[1] } } });
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Manage modules" }));
    const row = (await screen.findByText("Datenbanken")).closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Module name"), { target: { value: "Datenbanksysteme" } });
    fireEvent.change(screen.getByLabelText("Semester of this module"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() =>
      expect(sentBodies(fetchMock, "PATCH", "/api/admin/modules/m2")).toEqual([{ name: "Datenbanksysteme", semester: 4, votingEndsAt: null }]),
    );
  });

  it("sets a voting deadline on a module", async () => {
    const fetchMock = mockAdminApi({ "PATCH /api/admin/modules/m2": { status: 200, body: { module: MODULES[1] } } });
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Manage modules" }));
    const row = (await screen.findByText("Datenbanken")).closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/^Voting ends/), { target: { value: "2027-02-01T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() =>
      expect(sentBodies(fetchMock, "PATCH", "/api/admin/modules/m2")).toEqual([
        { name: "Datenbanken", semester: 3, votingEndsAt: new Date("2027-02-01T12:00").toISOString() },
      ]),
    );
  });

  it("ends voting for a whole semester after confirmation", async () => {
    const fetchMock = mockAdminApi({
      "POST /api/admin/courses/c1/close-semester": { status: 200, body: { closed: 1 } },
    });
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Manage modules" }));
    fireEvent.click(await screen.findByRole("button", { name: "End voting for semester 3" }));

    expect(await screen.findByText("Voting ended for 1 modules.")).toBeInTheDocument();
    expect(sentBodies(fetchMock, "POST", "/api/admin/courses/c1/close-semester")).toEqual([{ semester: 3 }]);
  });

  it("does not offer to end voting on a semester that is already closed", async () => {
    const closed = { ...MODULES[1], votingEndsAt: "2020-01-01T00:00:00.000Z" };
    mockAdminApi({ "GET /api/admin/courses/c1/modules": { status: 200, body: { modules: [MODULES[0], closed] } } });
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Manage modules" }));

    expect(await screen.findByText(/Voting ended/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End voting for semester 3" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End voting for semester 1" })).toBeInTheDocument();
  });

  it("cancels editing a module without saving", async () => {
    const fetchMock = mockAdminApi();
    renderAt("/admin");

    fireEvent.click(await screen.findByRole("button", { name: "Manage modules" }));
    const row = (await screen.findByText("Datenbanken")).closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Datenbanken")).toBeInTheDocument();
    expect(sentBodies(fetchMock, "PATCH", "/api/admin/modules/m2")).toEqual([]);
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

  it("allows deleting only a course without members", async () => {
    const empty = { ...COURSE, id: "c2", name: "INF25A", joinCode: "INF25A-AAAAAAAA", memberCount: 0 };
    const fetchMock = mockAdminApi({
      "GET /api/admin/courses": { status: 200, body: { courses: [COURSE, empty] } },
      "DELETE /api/admin/courses/c2": { status: 204 },
    });
    renderAt("/admin");

    const fullRow = (await screen.findByRole("heading", { name: "INF24B" })).closest("li")!;
    expect(within(fullRow).getByRole("button", { name: "Delete" })).toBeDisabled();
    const emptyRow = screen.getByRole("heading", { name: "INF25A" }).closest("li")!;
    fireEvent.click(within(emptyRow).getByRole("button", { name: "Delete" }));

    await vi.waitFor(() => expect(sentBodies(fetchMock, "DELETE", "/api/admin/courses/c2")).toHaveLength(1));
  });

  it("moves a user to another course or out of their course", async () => {
    const other = { ...COURSE, id: "c2", name: "INF25A", joinCode: "INF25A-AAAAAAAA", memberCount: 0 };
    const fetchMock = mockAdminApi({
      "GET /api/admin/courses": { status: 200, body: { courses: [COURSE, other] } },
      "PUT /api/admin/users/u1/course": { status: 200, body: { user: USERS[1] } },
    });
    renderAt("/admin");

    const select = await screen.findByLabelText("Course of student@dhbw.example");
    fireEvent.change(select, { target: { value: "c2" } });
    await vi.waitFor(() => expect(sentBodies(fetchMock, "PUT", "/api/admin/users/u1/course")).toHaveLength(1));
    fireEvent.change(select, { target: { value: "" } });

    await vi.waitFor(() =>
      expect(sentBodies(fetchMock, "PUT", "/api/admin/users/u1/course")).toEqual([{ courseId: "c2" }, { courseId: null }]),
    );
  });

  it("promotes another user but offers no button for yourself", async () => {
    const fetchMock = mockAdminApi({ "PATCH /api/admin/users/u1": { status: 200, body: { user: USERS[1] } } });
    renderAt("/admin");

    const ownRow = (await screen.findByText("admin@dhbw.example")).closest("tr")!;
    expect(within(ownRow).queryByRole("button")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Make admin" }));
    await vi.waitFor(() => expect(sentBodies(fetchMock, "PATCH", "/api/admin/users/u1")).toEqual([{ role: "admin" }]));
  });

  describe("users", () => {
    const MANY = [
      ...USERS,
      { id: "u2", email: "anna@dhbw.example", username: "anna", role: "user", courseId: null, courseName: null },
      { id: "u3", email: "ben@dhbw.example", username: "ben", role: "user", courseId: "c1", courseName: "INF24B" },
    ];

    it("searches by username or email", async () => {
      mockAdminApi({ "GET /api/admin/users": { status: 200, body: { users: MANY } } });
      renderAt("/admin");

      await screen.findByText("anna@dhbw.example");
      type(/Search users/, "ANN");

      expect(screen.getByText("anna@dhbw.example")).toBeInTheDocument();
      expect(screen.queryByText("ben@dhbw.example")).not.toBeInTheDocument();
      expect(screen.getByRole("status", { name: "" })).toHaveTextContent("1 of 4 users match");
    });

    it("filters by course, including people without a course, and by role", async () => {
      mockAdminApi({ "GET /api/admin/users": { status: 200, body: { users: MANY } } });
      renderAt("/admin");

      await screen.findByText("anna@dhbw.example");
      fireEvent.change(screen.getByLabelText("Course"), { target: { value: "none" } });
      expect(screen.getByText("anna@dhbw.example")).toBeInTheDocument();
      expect(screen.queryByText("ben@dhbw.example")).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Course"), { target: { value: "" } });
      fireEvent.click(screen.getByLabelText("Admins only"));
      expect(screen.getByText("admin@dhbw.example")).toBeInTheDocument();
      expect(screen.queryByText("student@dhbw.example")).not.toBeInTheDocument();
    });

    it("says when nothing matches", async () => {
      mockAdminApi({ "GET /api/admin/users": { status: 200, body: { users: MANY } } });
      renderAt("/admin");

      await screen.findByText("anna@dhbw.example");
      type(/Search users/, "nobody");

      expect(screen.getByText(/No users match/)).toBeInTheDocument();
    });

    it("shows 20 users first and the rest on request", async () => {
      const many = Array.from({ length: 25 }, (_, index) => ({
        id: `x${index}`,
        email: `user${String(index).padStart(2, "0")}@dhbw.example`,
        username: `user${index}`,
        role: "user",
        courseId: "c1",
        courseName: "INF24B",
      }));
      mockAdminApi({ "GET /api/admin/users": { status: 200, body: { users: many } } });
      renderAt("/admin");

      await screen.findByText("user00@dhbw.example");
      expect(screen.queryByText("user24@dhbw.example")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Show 5 more" }));

      expect(screen.getByText("user24@dhbw.example")).toBeInTheDocument();
    });
  });
});
