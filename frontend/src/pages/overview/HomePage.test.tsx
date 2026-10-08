import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeEventSource, mockApi, renderAt, sentBodies } from "../../testUtils";

const USER = { id: "1", email: "student@dhbw.example", username: "student", role: "user" };
const EMPTY = { free: 0, possible: 0, impossible: 0 };
const MATHE = {
  id: "m1",
  name: "Mathematik I",
  semester: 1,
  counts: { free: 3, possible: 1, impossible: 0 },
  myVote: null,
  canChangeAt: null,
  votingEndsAt: null,
  votingClosed: false,
  myGrade: null,
  gradeStats: null,
};
const DB = { id: "m2", name: "Datenbanken", semester: 3, counts: EMPTY, myVote: "free", canChangeAt: null, votingEndsAt: null, votingClosed: false, myGrade: null, gradeStats: null };
const IN_TEN_MINUTES = () => new Date(Date.now() + 10 * 60_000).toISOString();

/**
 * Mocks a logged-in student whose course has the given modules, with extra replies merged in.
 * @param {object[]} modules
 * @param {Record<string, {status: number, body?: object}>} extra
 */
function mockOverview(modules: object[], extra: Record<string, { status: number; body?: object }> = {}) {
  return mockApi({
    "GET /api/auth/me": { status: 200, body: { user: USER } },
    "GET /api/overview": { status: 200, body: { course: { id: "c1", name: "INF24B" }, modules } },
    ...extra,
  });
}

/**
 * Returns the tile of a module by its name.
 * @param {string} name
 */
async function tileOf(name: string) {
  return (await screen.findByRole("heading", { name })).closest("article")!;
}

describe("HomePage overview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the course and its modules grouped by semester", async () => {
    mockOverview([MATHE, DB]);
    renderAt("/");

    expect(await screen.findByRole("heading", { name: "INF24B" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Semester 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Semester 3" })).toBeInTheDocument();
  });

  it("labels the bar with counts so it does not rely on color", async () => {
    mockOverview([MATHE]);
    renderAt("/");

    const tile = await tileOf("Mathematik I");
    expect(within(tile).getByRole("img", { name: "Free 3, Possible 1, Impossible 0" })).toBeInTheDocument();
    expect(within(tile).getByText("4 votes")).toBeInTheDocument();
  });

  it("shows an empty bar for a module without votes", async () => {
    mockOverview([{ ...MATHE, counts: EMPTY }]);
    renderAt("/");

    const tile = await tileOf("Mathematik I");
    expect(within(tile).getByRole("img", { name: "No votes yet" })).toBeInTheDocument();
    expect(within(tile).queryByText("Free 0")).not.toBeInTheDocument();
  });

  it("marks the user's own vote as pressed", async () => {
    mockOverview([DB]);
    renderAt("/");

    const tile = await tileOf("Datenbanken");
    expect(within(tile).getByRole("button", { name: /Free/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(tile).getByRole("button", { name: /Possible/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("casts a vote and shows the new counts", async () => {
    const voted = { ...MATHE, counts: { free: 3, possible: 2, impossible: 0 }, myVote: "possible" };
    const fetchMock = mockOverview([MATHE], { "PUT /api/modules/m1/vote": { status: 200, body: { module: voted } } });
    renderAt("/");

    fireEvent.click(within(await tileOf("Mathematik I")).getByRole("button", { name: /Possible/ }));

    expect(await screen.findByText("5 votes")).toBeInTheDocument();
    expect(sentBodies(fetchMock, "PUT", "/api/modules/m1/vote")).toEqual([{ value: "possible" }]);
  });

  it("withdraws the vote when the selected button is clicked again", async () => {
    const withdrawn = { ...DB, myVote: null };
    const fetchMock = mockOverview([DB], { "DELETE /api/modules/m2/vote": { status: 200, body: { module: withdrawn } } });
    renderAt("/");

    const tile = await tileOf("Datenbanken");
    fireEvent.click(within(tile).getByRole("button", { name: /Free/ }));

    await vi.waitFor(() => expect(within(tile).getByRole("button", { name: /Free/ })).toHaveAttribute("aria-pressed", "false"));
    expect(sentBodies(fetchMock, "DELETE", "/api/modules/m2/vote")).toHaveLength(1);
  });

  it("links each module to its history", async () => {
    mockOverview([MATHE]);
    renderAt("/");

    expect(await screen.findByRole("link", { name: "Mathematik I" })).toHaveAttribute("href", "/modules/m1");
  });

  it("freezes a module whose voting has ended and says since when", async () => {
    mockOverview([{ ...DB, votingEndsAt: "2026-02-01T10:00:00.000Z", votingClosed: true }]);
    renderAt("/");

    const tile = await tileOf("Datenbanken");
    for (const button of within(within(tile).getByRole("group")).getAllByRole("button")) expect(button).toBeDisabled();
    expect(within(tile).getByText(/Voting ended on .*2026.*The result is final\./)).toBeInTheDocument();
  });

  it("moves modules with ended voting under Past modules and lets the user enter a grade", async () => {
    const closed = { ...DB, votingEndsAt: "2026-02-01T10:00:00.000Z", votingClosed: true };
    const graded = { ...closed, myGrade: 1.7 };
    const fetchMock = mockOverview([MATHE, closed], { "PUT /api/modules/m2/grade": { status: 200, body: { module: graded } } });
    renderAt("/");

    const tile = await tileOf("Datenbanken");
    expect(tile.closest("details")).toHaveTextContent("Past modules");
    expect((await tileOf("Mathematik I")).closest("details")).toBeNull();
    expect(within(tile).getByText(/appears once 5 classmates/)).toBeInTheDocument();
    fireEvent.change(within(tile).getByLabelText(/Your grade/), { target: { value: "1.7" } });
    fireEvent.click(within(tile).getByRole("button", { name: "Save grade" }));

    expect(await within(tile).findByRole("button", { name: "Remove grade" })).toBeInTheDocument();
    expect(sentBodies(fetchMock, "PUT", "/api/modules/m2/grade")).toEqual([{ grade: 1.7 }]);
  });

  it("shows average, best and worst grade once the server provides them", async () => {
    const stats = { count: 7, average: 2.4, best: 1, worst: 4.3 };
    mockOverview([{ ...DB, votingEndsAt: "2026-02-01T10:00:00.000Z", votingClosed: true, gradeStats: stats }]);
    renderAt("/");

    const tile = await tileOf("Datenbanken");
    expect(within(tile).getByText(/Average 2\.4, best 1\.0, worst 4\.3 \(7 grades\)/)).toBeInTheDocument();
  });

  it("announces the deadline while voting is still open", async () => {
    mockOverview([{ ...DB, votingEndsAt: "2099-02-01T10:00:00.000Z", votingClosed: false }]);
    renderAt("/");

    const tile = await tileOf("Datenbanken");
    expect(within(tile).getByText(/Voting ends on .*2099/)).toBeInTheDocument();
    for (const button of within(tile).getAllByRole("button")) expect(button).toBeEnabled();
  });

  it("locks the buttons during the cooldown and says until when", async () => {
    mockOverview([{ ...DB, canChangeAt: IN_TEN_MINUTES() }]);
    renderAt("/");

    const tile = await tileOf("Datenbanken");
    for (const button of within(tile).getAllByRole("button")) expect(button).toBeDisabled();
    expect(within(tile).getByText(/You can change your vote again at \d\d:\d\d/)).toBeInTheDocument();
  });

  it("locks the buttons right after voting", async () => {
    const voted = { ...MATHE, myVote: "free", canChangeAt: IN_TEN_MINUTES() };
    mockOverview([MATHE], { "PUT /api/modules/m1/vote": { status: 200, body: { module: voted } } });
    renderAt("/");

    const tile = await tileOf("Mathematik I");
    fireEvent.click(within(tile).getByRole("button", { name: /Free/ }));

    await vi.waitFor(() => expect(within(tile).getByRole("button", { name: /Possible/ })).toBeDisabled());
  });

  it("locks the buttons when the server refuses a change during the cooldown", async () => {
    mockOverview([DB], {
      "PUT /api/modules/m2/vote": { status: 429, body: { error: "vote_cooldown", retryAt: IN_TEN_MINUTES() } },
    });
    renderAt("/");

    const tile = await tileOf("Datenbanken");
    fireEvent.click(within(tile).getByRole("button", { name: /Possible/ }));

    expect(await within(tile).findByText(/You can change your vote again at/)).toBeInTheDocument();
    expect(within(tile).getByRole("button", { name: /Possible/ })).toBeDisabled();
  });

  it("unlocks the buttons when the cooldown is over", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockOverview([{ ...DB, canChangeAt: new Date(Date.now() + 60_000).toISOString() }]);
    renderAt("/");

    const tile = await tileOf("Datenbanken");
    expect(within(tile).getByRole("button", { name: /Possible/ })).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(61_000));

    expect(within(tile).getByRole("button", { name: /Possible/ })).toBeEnabled();
    vi.useRealTimers();
  });

  describe("live updates", () => {
    it("updates a module's bar when someone else votes", async () => {
      FakeEventSource.install();
      mockOverview([MATHE]);
      renderAt("/");

      const tile = await tileOf("Mathematik I");
      expect(FakeEventSource.latest().url).toBe("/api/events");
      act(() => FakeEventSource.latest().emit("module-votes", { type: "module-votes", moduleId: "m1", counts: { free: 3, possible: 1, impossible: 5 } }));

      expect(within(tile).getByRole("img", { name: "Free 3, Possible 1, Impossible 5" })).toBeInTheDocument();
      expect(within(tile).getByText("9 votes")).toBeInTheDocument();
    });

    it("keeps the user's own vote and cooldown when counts arrive", async () => {
      FakeEventSource.install();
      const locked = { ...DB, canChangeAt: IN_TEN_MINUTES() };
      mockOverview([locked]);
      renderAt("/");

      const tile = await tileOf("Datenbanken");
      act(() => FakeEventSource.latest().emit("module-votes", { type: "module-votes", moduleId: "m2", counts: { free: 2, possible: 0, impossible: 0 } }));

      expect(within(tile).getByRole("button", { name: /Free/ })).toHaveAttribute("aria-pressed", "true");
      expect(within(tile).getByRole("button", { name: /Possible/ })).toBeDisabled();
    });

    it("reloads the module list when an admin changes it, and after a reconnect", async () => {
      FakeEventSource.install();
      const fetchMock = mockOverview([MATHE]);
      renderAt("/");
      await tileOf("Mathematik I");
      const overviewLoads = () => fetchMock.mock.calls.filter(([path]) => path === "/api/overview").length;

      act(() => FakeEventSource.latest().emit("modules-changed", { type: "modules-changed" }));
      await vi.waitFor(() => expect(overviewLoads()).toBe(2));
      act(() => FakeEventSource.latest().emit("open"));
      act(() => FakeEventSource.latest().emit("open"));
      await vi.waitFor(() => expect(overviewLoads()).toBe(3));
    });

    it("closes the stream when leaving the page", async () => {
      FakeEventSource.install();
      mockOverview([MATHE]);
      renderAt("/");
      await tileOf("Mathematik I");
      const source = FakeEventSource.latest();

      cleanup();
      expect(source.closed).toBe(true);
    });
  });

  it("tells a user without a course what to do", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: { user: USER } },
      "GET /api/overview": { status: 200, body: { course: null, modules: [] } },
    });
    renderAt("/");

    expect(await screen.findByText(/You are not in a course/)).toBeInTheDocument();
  });
});
