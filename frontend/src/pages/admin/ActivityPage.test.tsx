import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi, renderAt } from "../../testUtils";

const ADMIN = { id: "a1", email: "admin@dhbw.example", username: "felix", role: "admin", language: "en" };
const entry = (overrides: object) => ({
  id: "e0",
  createdAt: "2026-10-01T10:00:00.000Z",
  category: "audit",
  action: "course.created",
  actor: "felix",
  actorEmail: "admin@dhbw.example",
  target: null,
  email: null,
  label: "INF24B",
  ip: "203.0.113.57",
  ...overrides,
});

/**
 * Mocks a logged-in admin and the replies of the log endpoint.
 * @param {Record<string, {status: number, body?: object}>} extra
 */
function mockActivity(extra: Record<string, { status: number; body?: object }> = {}, user: object = ADMIN) {
  return mockApi({
    "GET /api/auth/me": { status: 200, body: { user } },
    "GET /api/admin/audit?category=audit": {
      status: 200,
      body: {
        entries: [
          entry({ id: "e2", action: "user.role_changed", target: "anna", email: "anna@dhbw.example", label: "admin" }),
          entry({ id: "e1" }),
        ],
        nextCursor: null,
      },
    },
    "GET /api/admin/audit?category=access": {
      status: 200,
      body: {
        entries: [
          entry({ id: "a3", category: "access", action: "login.failed", actor: null, actorEmail: null, target: null, email: "nobody@dhbw.example", label: null, ip: "198.51.100.234" }),
          entry({ id: "a2", category: "access", action: "login.succeeded", actor: "anna", actorEmail: "anna@dhbw.example", email: "anna@dhbw.example", label: null, ip: "2001:db8::1" }),
          entry({ id: "a1", category: "access", action: "account.deleted", actor: null, actorEmail: null, email: "gone@dhbw.example", label: null }),
        ],
        nextCursor: null,
      },
    },
    ...extra,
  });
}

describe("ActivityPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists admin changes as sentences with the admin's email and the IP address", async () => {
    mockActivity();
    renderAt("/admin/activity");

    expect(await screen.findByText("felix created the course INF24B")).toBeInTheDocument();
    const row = screen.getByText("felix created the course INF24B").closest("tr")!;
    expect(within(row).getByText("admin@dhbw.example")).toBeInTheDocument();
    expect(within(row).getByText("203.0.113.57")).toBeInTheDocument();
    expect(screen.getByText(/Entries are kept for 1 year/)).toBeInTheDocument();
  });

  it("shows both the admin's and the affected user's email for a change to a user", async () => {
    mockActivity();
    renderAt("/admin/activity");

    const row = (await screen.findByText("felix changed the role of anna to Admin")).closest("tr")!;
    expect(within(row).getByText("admin@dhbw.example")).toBeInTheDocument();
    expect(within(row).getByText("anna@dhbw.example")).toBeInTheDocument();
  });

  it("switches to sign-ins and shows full email and IP addresses, also for unknown and deleted accounts", async () => {
    mockActivity();
    renderAt("/admin/activity");
    await screen.findByText("felix created the course INF24B");

    fireEvent.click(screen.getByRole("button", { name: "Sign-ins and accounts" }));

    const failed = (await screen.findByText("Failed login: no account has this email address")).closest("tr")!;
    expect(within(failed).getByText("nobody@dhbw.example")).toBeInTheDocument();
    expect(within(failed).getByText("198.51.100.234")).toBeInTheDocument();
    const login = screen.getByText("anna logged in").closest("tr")!;
    expect(within(login).getAllByText("anna@dhbw.example")).toHaveLength(1);
    expect(within(login).getByText("2001:db8::1")).toBeInTheDocument();
    const deleted = screen.getByText("An account was deleted").closest("tr")!;
    expect(within(deleted).getByText("gone@dhbw.example")).toBeInTheDocument();
    expect(screen.getByText(/kept for 90 days/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign-ins and accounts" })).toHaveAttribute("aria-pressed", "true");
  });

  it("writes an entry of a deleted account as such", async () => {
    mockActivity({
      "GET /api/admin/audit?category=access": {
        status: 200,
        body: { entries: [entry({ category: "access", action: "login.succeeded", actor: null, actorEmail: null, email: "gone@dhbw.example", label: null })], nextCursor: null },
      },
    });
    renderAt("/admin/activity");
    await screen.findByText("felix created the course INF24B");

    fireEvent.click(screen.getByRole("button", { name: "Sign-ins and accounts" }));

    expect(await screen.findByText("A deleted account logged in")).toBeInTheDocument();
  });

  it("loads older entries with the cursor of the previous page", async () => {
    const fetchMock = mockActivity({
      "GET /api/admin/audit?category=audit": {
        status: 200,
        body: { entries: [entry({ id: "n1", label: "NEW" })], nextCursor: "2026-10-01T09:00:00.000Z|abc" },
      },
      "GET /api/admin/audit?category=audit&cursor=2026-10-01T09%3A00%3A00.000Z%7Cabc": {
        status: 200,
        body: { entries: [entry({ id: "o1", label: "OLD" })], nextCursor: null },
      },
    });
    renderAt("/admin/activity");
    await screen.findByText("felix created the course NEW");

    fireEvent.click(screen.getByRole("button", { name: "Show older entries" }));

    expect(await screen.findByText("felix created the course OLD")).toBeInTheDocument();
    expect(screen.getByText("felix created the course NEW")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show older entries" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("cursor="), expect.anything());
  });

  it("says when nothing was recorded yet", async () => {
    mockActivity({ "GET /api/admin/audit?category=audit": { status: 200, body: { entries: [], nextCursor: null } } });
    renderAt("/admin/activity");

    expect(await screen.findByText("Nothing recorded yet.")).toBeInTheDocument();
  });

  it("shows why loading failed", async () => {
    mockActivity({ "GET /api/admin/audit?category=audit": { status: 500, body: { error: "internal_error" } } });
    renderAt("/admin/activity");

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong on our side");
  });

  it("is written in German for a German account, with the dates of that language", async () => {
    mockActivity({}, { ...ADMIN, language: "de" });
    renderAt("/admin/activity");

    expect(await screen.findByText("felix hat den Kurs INF24B angelegt")).toBeInTheDocument();
    expect(screen.getByText("felix hat die Rolle von anna auf Admin gesetzt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anmeldungen und Konten" })).toBeInTheDocument();
    expect(screen.getByText("IP-Adresse")).toBeInTheDocument();
    expect(screen.getAllByText(/1\. Okt\. 2026|01\.10\.2026/)).toHaveLength(2);
  });

  it("searches on the server after a short pause and shows the result count", async () => {
    const fetchMock = mockActivity({
      "GET /api/admin/audit?category=audit&q=anna": {
        status: 200,
        body: { entries: [entry({ id: "m1", label: "MATCH" })], nextCursor: null },
      },
    });
    renderAt("/admin/activity");
    await screen.findByText("felix created the course INF24B");
    expect(screen.getByText("Showing 2 entries")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: " anna " } });

    expect(await screen.findByText("felix created the course MATCH")).toBeInTheDocument();
    expect(screen.queryByText("felix created the course INF24B")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 entry")).toBeInTheDocument();
    const calls = fetchMock.mock.calls.map(([path]) => path);
    expect(calls.filter((path) => String(path).includes("q="))).toEqual(["/api/admin/audit?category=audit&q=anna"]);
  });

  it("filters by event and time, and clears all filters again", async () => {
    mockActivity({
      "GET /api/admin/audit?category=audit&action=course.created&range=7d": {
        status: 200,
        body: { entries: [], nextCursor: null },
      },
    });
    renderAt("/admin/activity");
    await screen.findByText("felix created the course INF24B");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Event"), { target: { value: "course.created" } });
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "7d" } });

    expect(await screen.findByText("No entries match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(await screen.findByText("felix created the course INF24B")).toBeInTheDocument();
    expect(screen.getByLabelText("Event")).toHaveValue("");
    expect(screen.getByLabelText("Time")).toHaveValue("");
    expect(screen.queryByText("No entries match these filters.")).not.toBeInTheDocument();
  });

  it("searches for an email or IP address when it is clicked", async () => {
    mockActivity({
      "GET /api/admin/audit?category=audit&q=203.0.113.57": {
        status: 200,
        body: { entries: [entry({ id: "ip1", label: "BYIP" })], nextCursor: null },
      },
    });
    renderAt("/admin/activity");
    const row = (await screen.findByText("felix created the course INF24B")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: "203.0.113.57" }));

    expect(await screen.findByText("felix created the course BYIP")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toHaveValue("203.0.113.57");
  });

  it("offers only the events of the shown log and resets the event filter when switching", async () => {
    mockActivity();
    renderAt("/admin/activity");
    await screen.findByText("felix created the course INF24B");
    const events = screen.getByLabelText("Event");
    expect(within(events).getByRole("option", { name: "Course created" })).toBeInTheDocument();
    expect(within(events).queryByRole("option", { name: "Failed login" })).not.toBeInTheDocument();
    fireEvent.change(events, { target: { value: "course.created" } });

    fireEvent.click(screen.getByRole("button", { name: "Sign-ins and accounts" }));

    expect(await screen.findByText("anna logged in")).toBeInTheDocument();
    expect(screen.getByLabelText("Event")).toHaveValue("");
    expect(within(screen.getByLabelText("Event")).getByRole("option", { name: "Failed login" })).toBeInTheDocument();
  });

  it("labels the filters in German", async () => {
    mockActivity({}, { ...ADMIN, language: "de" });
    renderAt("/admin/activity");
    await screen.findByText("felix hat den Kurs INF24B angelegt");

    expect(screen.getByLabelText("Suche")).toBeInTheDocument();
    expect(screen.getByLabelText("Ereignis")).toBeInTheDocument();
    expect(screen.getByLabelText("Zeitraum")).toBeInTheDocument();
  });

  it("is linked from the admin page and sends students away", async () => {
    mockActivity();
    renderAt("/admin");

    expect(await screen.findByRole("link", { name: "Activity log" })).toHaveAttribute("href", "/admin/activity");
  });

  it("is not for students", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: { user: { ...ADMIN, role: "user" } } },
      "GET /api/overview": { status: 200, body: { course: null, modules: [] } },
    });
    renderAt("/admin/activity");

    expect(await screen.findByText(/You are not in a course yet/)).toBeInTheDocument();
    expect(screen.queryByText("Activity log")).not.toBeInTheDocument();
  });
});
