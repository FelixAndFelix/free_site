import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi, renderAt, sentBodies } from "../../testUtils";

const USER = { id: "1", email: "student@dhbw.example", username: "student", role: "user" };
const EMPTY = { free: 0, possible: 0, impossible: 0 };
const MATHE = {
  id: "m1",
  name: "Mathematik I",
  semester: 1,
  counts: { free: 3, possible: 1, impossible: 0 },
  myVote: null,
  canChangeAt: null,
};
const DB = { id: "m2", name: "Datenbanken", semester: 3, counts: EMPTY, myVote: "free", canChangeAt: null };
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

  it("tells a user without a course what to do", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: { user: USER } },
      "GET /api/overview": { status: 200, body: { course: null, modules: [] } },
    });
    renderAt("/");

    expect(await screen.findByText(/You are not in a course/)).toBeInTheDocument();
  });
});
