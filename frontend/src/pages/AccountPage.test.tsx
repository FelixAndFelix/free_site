import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi, renderAt, sentBodies, type } from "../testUtils";

const USER = { id: "1", email: "student@dhbw.example", username: "student", role: "user" };

/**
 * Mocks a logged-in student plus the reply to the delete request.
 * @param {{status: number, body?: object}} deleteReply
 */
function mockAccount(deleteReply: { status: number; body?: object }) {
  return mockApi({
    "GET /api/auth/me": { status: 200, body: { user: USER } },
    "DELETE /api/auth/account": deleteReply,
  });
}

describe("AccountPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the username and email", async () => {
    mockAccount({ status: 204 });
    renderAt("/account");

    expect(await screen.findByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByText("student")).toBeInTheDocument();
    expect(screen.getByText(/student@dhbw.example/)).toBeInTheDocument();
  });

  it("only allows deleting after the confirmation is ticked", async () => {
    mockAccount({ status: 204 });
    renderAt("/account");

    const button = await screen.findByRole("button", { name: "Delete my account" });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/I understand/));
    expect(button).toBeEnabled();
  });

  it("deletes the account with the password and shows the goodbye page", async () => {
    const fetchMock = mockAccount({ status: 204 });
    renderAt("/account");

    await screen.findByRole("heading", { name: "Account" });
    type(/^Password/, "correct horse battery");
    fireEvent.click(screen.getByLabelText(/I understand/));
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(await screen.findByRole("heading", { name: "Account deleted" })).toBeInTheDocument();
    expect(sentBodies(fetchMock, "DELETE", "/api/auth/account")).toEqual([{ password: "correct horse battery" }]);
  });

  it("explains a wrong password", async () => {
    mockAccount({ status: 401, body: { error: "invalid_credentials" } });
    renderAt("/account");

    await screen.findByRole("heading", { name: "Account" });
    type(/^Password/, "wrong");
    fireEvent.click(screen.getByLabelText(/I understand/));
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is wrong.");
  });

  it("explains why the last admin cannot leave", async () => {
    mockAccount({ status: 409, body: { error: "last_admin" } });
    renderAt("/account");

    await screen.findByRole("heading", { name: "Account" });
    type(/^Password/, "correct horse battery");
    fireEvent.click(screen.getByLabelText(/I understand/));
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You are the only admin.");
  });
});
