import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi, renderAt } from "../testUtils";

describe("PrivacyPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is reachable without logging in", async () => {
    mockApi({});
    renderAt("/privacy");

    expect(await screen.findByRole("heading", { name: "Privacy" })).toBeInTheDocument();
  });

  it("says plainly that the operator can link votes to emails", async () => {
    mockApi({});
    renderAt("/privacy");

    expect(await screen.findByText(/The operator can link your votes to your email address/)).toBeInTheDocument();
  });

  it("names the contact and the services that process data", async () => {
    mockApi({});
    renderAt("/privacy");

    await screen.findByRole("heading", { name: "Privacy" });
    expect(screen.getAllByRole("link", { name: "mail@felixkarg.de" })[0]).toHaveAttribute("href", "mailto:mail@felixkarg.de");
    expect(screen.getByText(/Cloudflare, Inc\./)).toBeInTheDocument();
    expect(screen.getByText(/Resend, Inc\./)).toBeInTheDocument();
  });

  it("lists every kind of stored data with how long it is kept", async () => {
    mockApi({});
    renderAt("/privacy");

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getByRole("rowheader").textContent)).toEqual([
      "DHBW email address",
      "Username",
      "Password",
      "Course and role",
      "Language",
      "Language choice in your browser",
      "Your votes",
      "Vote history",
      "Session cookie",
      "Email codes",
      "IP address",
      "Database backups",
    ]);
  });

  it("is linked from every page and from the registration form", async () => {
    mockApi({});
    renderAt("/register");

    expect(await screen.findByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "How your data is handled" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("href", "/.well-known/security.txt");
  });
});
