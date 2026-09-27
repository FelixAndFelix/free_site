import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { AuthProvider } from "./auth";

type Reply = { status: number; body?: object };

const USER = { id: "1", email: "student@dhbw.example", role: "user" };

/**
 * Replaces fetch with fixed replies per "METHOD path"; unlisted requests answer 401.
 * @param {Record<string, Reply>} replies
 */
function mockApi(replies: Record<string, Reply>) {
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    const { status, body = {} } = replies[`${init?.method ?? "GET"} ${path}`] ?? { status: 401, body: { error: "unauthenticated" } };
    return { ok: status < 400, status, json: async () => body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * Renders the app at a path.
 * @param {string} path
 */
function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/**
 * Types a value into the input with the given label.
 * @param {RegExp} label
 * @param {string} value
 */
function type(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends a logged-out visitor to the login screen", async () => {
    mockApi({});
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("shows the home screen for a logged-in user", async () => {
    mockApi({ "GET /api/auth/me": { status: 200, body: { user: USER } } });
    renderAt("/");
    expect(await screen.findByText(`Logged in as ${USER.email}`)).toBeInTheDocument();
  });

  it("logs in and opens the home screen", async () => {
    const fetchMock = mockApi({ "POST /api/auth/login": { status: 200, body: { user: USER } } });
    renderAt("/login");

    await screen.findByRole("heading", { name: "Log in" });
    type(/DHBW email/, USER.email);
    type(/Password/, "correct horse battery");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText(`Logged in as ${USER.email}`)).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({
      email: USER.email,
      password: "correct horse battery",
    });
  });

  it("shows the error for wrong credentials", async () => {
    mockApi({ "POST /api/auth/login": { status: 401, body: { error: "invalid_credentials" } } });
    renderAt("/login");

    await screen.findByRole("heading", { name: "Log in" });
    type(/DHBW email/, USER.email);
    type(/Password/, "wrong password");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is wrong.");
  });

  it("registers in two steps", async () => {
    mockApi({
      "POST /api/auth/register/start": { status: 202 },
      "POST /api/auth/register/complete": { status: 201, body: { user: USER } },
    });
    renderAt("/register");

    await screen.findByRole("heading", { name: "Create an account" });
    type(/DHBW email/, USER.email);
    type(/Course code/, "WS24-123");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    await screen.findByRole("heading", { name: "Check your email" });
    type(/Code/, "123456");
    type(/Password/, "correct horse battery");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(`Logged in as ${USER.email}`)).toBeInTheDocument();
  });

  it("explains a rejected email domain", async () => {
    mockApi({ "POST /api/auth/register/start": { status: 400, body: { error: "email_domain_not_allowed" } } });
    renderAt("/register");

    await screen.findByRole("heading", { name: "Create an account" });
    type(/DHBW email/, "someone@gmail.com");
    type(/Course code/, "WS24-123");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please use your DHBW email address.");
  });

  it("resets the password in two steps", async () => {
    mockApi({ "POST /api/auth/reset/start": { status: 202 }, "POST /api/auth/reset/complete": { status: 204 } });
    renderAt("/reset");

    type(/DHBW email/, USER.email);
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByRole("heading", { name: "Check your email" });
    type(/Code/, "123456");
    type(/New password/, "a brand new password");
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByRole("heading", { name: "Password changed" })).toBeInTheDocument();
  });
});
