import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeEventSource, mockApi, renderAt } from "../../testUtils";

const USER = { id: "1", email: "student@dhbw.example", username: "student", role: "user" };
const MODULE = {
  id: "m1",
  name: "Datenbanken",
  semester: 3,
  counts: { free: 1, possible: 2, impossible: 0 },
  myVote: null,
  canChangeAt: null,
};
const HISTORY = [
  { day: "2026-10-01", counts: { free: 3, possible: 0, impossible: 0 } },
  { day: "2026-10-02", counts: { free: 2, possible: 1, impossible: 0 } },
  { day: "2026-10-03", counts: { free: 1, possible: 2, impossible: 0 } },
];

/**
 * Mocks a logged-in student and the module detail, with extra replies merged in.
 * @param {object[]} history
 * @param {Record<string, {status: number, body?: object}>} extra
 */
function mockDetail(history: object[], extra: Record<string, { status: number; body?: object }> = {}) {
  return mockApi({
    "GET /api/auth/me": { status: 200, body: { user: USER } },
    "GET /api/modules/m1": { status: 200, body: { module: MODULE, history } },
    ...extra,
  });
}

describe("ModulePage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the module with its history chart", async () => {
    mockDetail(HISTORY);
    renderAt("/modules/m1");

    expect(await screen.findByRole("heading", { name: "Datenbanken" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Votes per day from Thu 1 October to Sat 3 October/ })).toBeInTheDocument();
  });

  it("offers every value in a table, newest day first", async () => {
    mockDetail(HISTORY);
    renderAt("/modules/m1");

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Sat 3 Oct120");
    expect(rows[3]).toHaveTextContent("Thu 1 Oct300");
  });

  it("reads single days with the arrow keys", async () => {
    mockDetail(HISTORY);
    renderAt("/modules/m1");

    const chart = await screen.findByRole("img", { name: /Votes per day/ });
    fireEvent.keyDown(chart, { key: "ArrowLeft" });

    const tooltip = screen.getByRole("status");
    expect(tooltip).toHaveTextContent("Fri 2 October");
    expect(tooltip).toHaveTextContent("2Free");
    expect(tooltip).toHaveTextContent("1Possible");
  });

  it("explains that the history starts with the first vote", async () => {
    mockDetail([]);
    renderAt("/modules/m1");

    expect(await screen.findByText(/The history starts with the first vote/)).toBeInTheDocument();
  });

  it("reloads the history after voting", async () => {
    const fetchMock = mockDetail(HISTORY, {
      "PUT /api/modules/m1/vote": { status: 200, body: { module: { ...MODULE, myVote: "free" } } },
    });
    renderAt("/modules/m1");

    fireEvent.click(await screen.findByRole("button", { name: /Free/ }));

    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.filter(([path, init]) => path === "/api/modules/m1" && init?.method === "GET")).toHaveLength(2),
    );
  });

  it("reloads the history when someone votes on this module, but not on others", async () => {
    FakeEventSource.install();
    const fetchMock = mockDetail(HISTORY);
    renderAt("/modules/m1");
    await screen.findByRole("heading", { name: "Datenbanken" });
    const detailLoads = () => fetchMock.mock.calls.filter(([path]) => path === "/api/modules/m1").length;

    act(() => FakeEventSource.latest().emit("module-votes", { type: "module-votes", moduleId: "m2", counts: {} }));
    act(() => FakeEventSource.latest().emit("module-votes", { type: "module-votes", moduleId: "m1", counts: {} }));

    await vi.waitFor(() => expect(detailLoads()).toBe(2));
  });

  it("shows an error for a module outside the user's course", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: { user: USER } },
      "GET /api/modules/m9": { status: 404, body: { error: "not_found" } },
    });
    renderAt("/modules/m9");

    expect(await screen.findByRole("alert")).toHaveTextContent("This no longer exists.");
  });
});
