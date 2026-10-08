import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi, renderAt, sentBodies, type } from "../testUtils";

const USER = { id: "1", email: "student@dhbw.example", username: "student", role: "user" };
const CODE = "INF24B-7KQ2XMPA";
const GUEST = { "GET /api/auth/me": { status: 401, body: { error: "unauthenticated" } } };
const LOGGED_IN = { "GET /api/auth/me": { status: 200, body: { user: USER } } };

/**
 * Mocks the look-up of the invite link with the given membership of a logged-in user.
 * @param {object} info
 */
function mockLookup(info: object) {
  return { [`GET /api/join/${CODE}`]: { status: 200, body: info } };
}

describe("invite links", () => {
  afterEach(() => vi.unstubAllGlobals());

  describe("for guests", () => {
    it("offers registration and login with the course attached", async () => {
      mockApi({ ...GUEST, ...mockLookup({ course: { name: "INF24B" } }) });
      renderAt(`/join/${CODE}`);

      expect(await screen.findByRole("heading", { name: "Join INF24B" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", `/register?join=${CODE}`);
      expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", `/login?join=${CODE}`);
    });

    it("says what to do when the link is not valid", async () => {
      mockApi({ ...GUEST, [`GET /api/join/${CODE}`]: { status: 404, body: { error: "not_found" } } });
      renderAt(`/join/${CODE}`);

      expect(await screen.findByRole("heading", { name: "Invite link not valid" })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Ask an admin of your course for a new one.");
    });

    it("registers without asking for the course code, using the one of the link", async () => {
      const fetchMock = mockApi({
        ...GUEST,
        ...mockLookup({ course: { name: "INF24B" } }),
        "POST /api/auth/register/start": { status: 202 },
      });
      renderAt(`/register?join=${CODE}`);

      expect(await screen.findByText("INF24B")).toBeInTheDocument();
      expect(screen.queryByLabelText("Course code")).not.toBeInTheDocument();
      type(/DHBW email/, "student@dhbw.example");
      type(/Username/, "student");
      fireEvent.click(screen.getByRole("button", { name: "Send code" }));

      await screen.findByRole("heading", { name: "Check your email" });
      expect(sentBodies(fetchMock, "POST", "/api/auth/register/start")).toEqual([
        { email: "student@dhbw.example", username: "student", courseCode: CODE, adminSetupCode: "" },
      ]);
    });

    it("lands on the overview after registering through the link", async () => {
      mockApi({
        ...GUEST,
        ...mockLookup({ course: { name: "INF24B" } }),
        "POST /api/auth/register/start": { status: 202 },
        "POST /api/auth/register/complete": { status: 201, body: { user: USER } },
        "GET /api/overview": { status: 200, body: { course: { id: "c1", name: "INF24B" }, modules: [] } },
      });
      renderAt(`/register?join=${CODE}`);

      await screen.findByText("INF24B");
      type(/DHBW email/, "student@dhbw.example");
      type(/Username/, "student");
      fireEvent.click(screen.getByRole("button", { name: "Send code" }));
      await screen.findByRole("heading", { name: "Check your email" });
      type(/^Code/, "123456");
      type(/Password/, "correct horse battery");
      fireEvent.click(screen.getByRole("button", { name: "Create account" }));

      expect(await screen.findByText(/There are no modules in this course yet/)).toBeInTheDocument();
      expect(screen.queryByText(/You are in INF24B/)).not.toBeInTheDocument();
    });

    it("falls back to the course code field when the link is not valid", async () => {
      mockApi({ ...GUEST, [`GET /api/join/${CODE}`]: { status: 404, body: { error: "not_found" } } });
      renderAt(`/register?join=${CODE}`);

      expect(await screen.findByRole("alert")).toHaveTextContent("This invite link is not valid");
      expect(screen.getByLabelText("Course code")).toBeInTheDocument();
    });

    it("keeps the invite when switching between login and registration", async () => {
      mockApi({ ...GUEST, ...mockLookup({ course: { name: "INF24B" } }) });
      renderAt(`/login?join=${CODE}`);

      expect(await screen.findByRole("link", { name: "Create an account" })).toHaveAttribute(
        "href",
        `/register?join=${CODE}`,
      );
    });

    it("continues to the invite link after logging in", async () => {
      mockApi({
        ...GUEST,
        "POST /api/auth/login": { status: 200, body: { user: USER } },
        [`GET /api/join/${CODE}`]: { status: 200, body: { course: { name: "INF24B" }, membership: "none" } },
      });
      renderAt(`/login?join=${CODE}`);

      await screen.findByLabelText(/DHBW email/);
      type(/DHBW email/, "student@dhbw.example");
      type(/Password/, "correct horse battery");
      fireEvent.click(screen.getByRole("button", { name: "Log in" }));

      expect(await screen.findByRole("heading", { name: "Join INF24B" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Join INF24B" })).toBeInTheDocument();
    });
  });

  describe("for logged-in users", () => {
    it("joins the course with one click", async () => {
      const fetchMock = mockApi({
        ...LOGGED_IN,
        ...mockLookup({ course: { name: "INF24B" }, membership: "none" }),
        [`POST /api/join/${CODE}`]: { status: 200, body: { course: { id: "c1", name: "INF24B" } } },
        "GET /api/overview": { status: 200, body: { course: { id: "c1", name: "INF24B" }, modules: [] } },
      });
      renderAt(`/join/${CODE}`);

      fireEvent.click(await screen.findByRole("button", { name: "Join INF24B" }));

      expect(await screen.findByRole("heading", { name: "INF24B" })).toBeInTheDocument();
      expect(sentBodies(fetchMock, "POST", `/api/join/${CODE}`)).toEqual([{ confirmSwitch: false }]);
    });

    it("tells members of the course that nothing is left to do", async () => {
      mockApi({ ...LOGGED_IN, ...mockLookup({ course: { name: "INF24B" }, membership: "same" }) });
      renderAt(`/join/${CODE}`);

      expect(await screen.findByRole("heading", { name: "You are in INF24B" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Join|Switch/ })).not.toBeInTheDocument();
    });

    it("asks before switching from another course and names the consequence", async () => {
      const fetchMock = mockApi({
        ...LOGGED_IN,
        ...mockLookup({ course: { name: "INF24B" }, membership: "other", currentCourseName: "INF23A" }),
        [`POST /api/join/${CODE}`]: { status: 200, body: { course: { id: "c1", name: "INF24B" } } },
        "GET /api/overview": { status: 200, body: { course: { id: "c1", name: "INF24B" }, modules: [] } },
      });
      renderAt(`/join/${CODE}`);

      expect(await screen.findByRole("heading", { name: "Switch to INF24B?" })).toBeInTheDocument();
      expect(screen.getByText(/your votes there are removed/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Stay in INF23A" })).toHaveAttribute("href", "/");
      expect(sentBodies(fetchMock, "POST", `/api/join/${CODE}`)).toEqual([]);

      fireEvent.click(screen.getByRole("button", { name: "Switch to INF24B" }));

      await screen.findByRole("heading", { name: "INF24B" });
      expect(sentBodies(fetchMock, "POST", `/api/join/${CODE}`)).toEqual([{ confirmSwitch: true }]);
    });

    it("shows why joining failed", async () => {
      mockApi({
        ...LOGGED_IN,
        ...mockLookup({ course: { name: "INF24B" }, membership: "none" }),
        [`POST /api/join/${CODE}`]: { status: 404, body: { error: "not_found" } },
      });
      renderAt(`/join/${CODE}`);

      fireEvent.click(await screen.findByRole("button", { name: "Join INF24B" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("no longer exists");
    });
  });
});
