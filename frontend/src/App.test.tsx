import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findLoggedInAs, mockApi, renderAt, type } from "./testUtils";

const USER = { id: "1", email: "student@dhbw.example", username: "student", role: "user" };

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
    expect(await findLoggedInAs("student")).toBeInTheDocument();
  });

  describe("header", () => {
    it("shows the logo, the way home and the user's links", async () => {
      mockApi({ "GET /api/auth/me": { status: 200, body: { user: { ...USER, role: "admin" } } } });
      renderAt("/");
      await findLoggedInAs("student");

      expect(screen.getByRole("link", { name: "FreeSite" })).toHaveAttribute("href", "/");
      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
      expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    });

    it("marks the current page and hides the admin link from users", async () => {
      mockApi({ "GET /api/auth/me": { status: 200, body: { user: USER } } });
      renderAt("/account");
      await findLoggedInAs("student");

      expect(screen.getByRole("link", { name: "student (account)" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
      expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    });

    it("shows only the logo to a logged-out visitor", async () => {
      mockApi({});
      renderAt("/login");
      await screen.findByRole("heading", { name: "Log in" });

      expect(screen.getByRole("link", { name: "FreeSite" })).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    });
  });

  it("logs in and opens the home screen", async () => {
    const fetchMock = mockApi({ "POST /api/auth/login": { status: 200, body: { user: USER } } });
    renderAt("/login");

    await screen.findByRole("heading", { name: "Log in" });
    type(/DHBW email/, USER.email);
    type(/Password/, "correct horse battery");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await findLoggedInAs("student")).toBeInTheDocument();
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
    const fetchMock = mockApi({
      "POST /api/auth/register/start": { status: 202 },
      "POST /api/auth/register/complete": { status: 201, body: { user: USER } },
    });
    renderAt("/register");

    await screen.findByRole("heading", { name: "Create an account" });
    type(/DHBW email/, USER.email);
    type(/^Username/, "student");
    type(/Course code/, "WS24-123");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    await screen.findByRole("heading", { name: "Check your email" });
    type(/Code/, "123456");
    type(/Password/, "correct horse battery");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await findLoggedInAs("student")).toBeInTheDocument();
    const [, start, complete] = fetchMock.mock.calls.map(([, init]) => JSON.parse((init?.body as string) ?? "{}"));
    expect(start).toMatchObject({ username: "student" });
    expect(complete).toMatchObject({ username: "student" });
  });

  it("explains a rejected email domain", async () => {
    mockApi({ "POST /api/auth/register/start": { status: 400, body: { error: "email_domain_not_allowed" } } });
    renderAt("/register");

    await screen.findByRole("heading", { name: "Create an account" });
    type(/DHBW email/, "someone@gmail.com");
    type(/^Username/, "student");
    type(/Course code/, "WS24-123");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please use your DHBW email address.");
  });

  it("sends the admin setup code only when it is given", async () => {
    const fetchMock = mockApi({ "POST /api/auth/register/start": { status: 202 } });
    renderAt("/register");

    await screen.findByRole("heading", { name: "Create an account" });
    type(/DHBW email/, USER.email);
    type(/^Username/, "student");
    type(/Course code/, "INF24B-7KQ2XMPA");
    fireEvent.click(screen.getByText("I have an admin setup code"));
    type(/Admin setup code/, "the-setup-code");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    await screen.findByRole("heading", { name: "Check your email" });
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toMatchObject({ adminSetupCode: "the-setup-code" });
  });

  it("lets a logged-in user claim admin with the setup code", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: { user: USER } },
      "POST /api/auth/claim-admin": { status: 200, body: { user: { ...USER, role: "admin" } } },
      "GET /api/admin/courses": { status: 200, body: { courses: [] } },
      "GET /api/admin/users": { status: 200, body: { users: [] } },
    });
    renderAt("/claim-admin");

    await screen.findByLabelText(/Admin setup code/);
    type(/Admin setup code/, "the-setup-code");
    fireEvent.click(screen.getByRole("button", { name: "Become admin" }));

    expect(await screen.findByRole("heading", { name: "Admin" })).toBeInTheDocument();
  });

  it("asks an account without a username to choose one first", async () => {
    const fetchMock = mockApi({
      "GET /api/auth/me": { status: 200, body: { user: { ...USER, username: null } } },
      "PUT /api/auth/username": { status: 200, body: { user: USER } },
    });
    renderAt("/");

    expect(await screen.findByRole("heading", { name: "Choose a username" })).toBeInTheDocument();
    type(/^Username/, "student");
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));

    expect(await findLoggedInAs("student")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ username: "student" });
  });

  it("explains a taken username", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: { user: USER } },
      "PUT /api/auth/username": { status: 409, body: { error: "username_taken" } },
    });
    renderAt("/username");

    expect(await screen.findByRole("heading", { name: "Change username" })).toBeInTheDocument();
    type(/^Username/, "felix");
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This username is already taken.");
  });

  it("links admins to the admin page", async () => {
    mockApi({ "GET /api/auth/me": { status: 200, body: { user: { ...USER, role: "admin" } } } });
    renderAt("/");
    expect(await screen.findByRole("link", { name: /Admin/ })).toHaveAttribute("href", "/admin");
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
