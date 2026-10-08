import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findLoggedInAs, mockApi, renderAt, sentBodies, type } from "../testUtils";

const USER_EN = { id: "1", email: "student@dhbw.example", username: "student", role: "user", language: "en" };
const USER_DE = { ...USER_EN, language: "de" };
const GUEST = { "GET /api/auth/me": { status: 401, body: { error: "unauthenticated" } } };

/**
 * Pretends the browser prefers the given languages.
 * @param {string[]} languages
 */
function browserLanguages(languages: string[]) {
  Object.defineProperty(window.navigator, "languages", { value: languages, configurable: true });
}

describe("interface language", () => {
  beforeEach(() => {
    window.localStorage.clear();
    browserLanguages(["en-US"]);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.lang = "";
  });

  describe("for visitors", () => {
    it("follows a German browser", async () => {
      browserLanguages(["de-DE", "de"]);
      mockApi(GUEST);
      renderAt("/login");

      expect(await screen.findByRole("heading", { name: "Anmelden" })).toBeInTheDocument();
      expect(screen.getByLabelText("Passwort")).toBeInTheDocument();
      expect(document.documentElement.lang).toBe("de");
    });

    it("can be switched in the footer, and the choice is remembered", async () => {
      browserLanguages(["de-DE"]);
      mockApi(GUEST);
      renderAt("/login");
      await screen.findByRole("heading", { name: "Anmelden" });

      fireEvent.click(screen.getByRole("button", { name: "English" }));

      expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
      expect(window.localStorage.getItem("language")).toBe("en");
      expect(document.documentElement.lang).toBe("en");
    });

    it("sends the page language with the registration, so the code mail matches", async () => {
      browserLanguages(["de-DE"]);
      const fetchMock = mockApi({ ...GUEST, "POST /api/auth/register/start": { status: 202 } });
      renderAt("/register");

      await screen.findByRole("heading", { name: "Konto erstellen" });
      type(/DHBW-E-Mail/, "student@dhbw.example");
      type(/Benutzername/, "student");
      type(/Kurscode/, "INF24B-CODE");
      fireEvent.click(screen.getByRole("button", { name: "Code senden" }));

      await screen.findByRole("heading", { name: "Schau in dein Postfach" });
      expect(sentBodies(fetchMock, "POST", "/api/auth/register/start")).toEqual([
        { email: "student@dhbw.example", username: "student", courseCode: "INF24B-CODE", adminSetupCode: "", language: "de" },
      ]);
    });

    it("sends the page language with a password reset", async () => {
      browserLanguages(["de-DE"]);
      const fetchMock = mockApi({ ...GUEST, "POST /api/auth/reset/start": { status: 202 } });
      renderAt("/reset");

      await screen.findByRole("heading", { name: "Passwort zurücksetzen" });
      type(/DHBW-E-Mail/, "student@dhbw.example");
      fireEvent.click(screen.getByRole("button", { name: "Code senden" }));

      await screen.findByRole("heading", { name: "Schau in dein Postfach" });
      expect(sentBodies(fetchMock, "POST", "/api/auth/reset/start")).toEqual([
        { email: "student@dhbw.example", language: "de" },
      ]);
    });

    it("shows errors in the page language", async () => {
      browserLanguages(["de-DE"]);
      mockApi({ ...GUEST, "POST /api/auth/login": { status: 401, body: { error: "invalid_credentials" } } });
      renderAt("/login");

      await screen.findByRole("heading", { name: "Anmelden" });
      type(/DHBW-E-Mail/, "student@dhbw.example");
      type(/Passwort/, "falsch");
      fireEvent.click(screen.getAllByRole("button", { name: "Anmelden" })[0]!);

      expect(await screen.findByRole("alert")).toHaveTextContent("E-Mail oder Passwort ist falsch.");
    });
  });

  describe("for accounts", () => {
    it("uses the account language, even in an English browser", async () => {
      mockApi({
        "GET /api/auth/me": { status: 200, body: { user: USER_DE } },
        "GET /api/overview": {
          status: 200,
          body: {
            course: { id: "c1", name: "INF24B" },
            modules: [
              { id: "m1", name: "Datenbanken", semester: 3, counts: { free: 7, possible: 1, impossible: 0 }, myVote: null, canChangeAt: null },
            ],
          },
        },
      });
      renderAt("/");

      expect(await screen.findByText("Überwiegend geschenkt")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Semester 3" })).toBeInTheDocument();
      expect(screen.getByText("1 Modul")).toBeInTheDocument();
      expect(screen.getByText("8 Stimmen")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Geschenkt/ })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Übersicht" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "English" })).not.toBeInTheDocument();
    });

    it("keeps the account language after logging out", async () => {
      mockApi({
        "GET /api/auth/me": { status: 200, body: { user: USER_DE } },
        "GET /api/overview": { status: 200, body: { course: null, modules: [] } },
        "POST /api/auth/logout": { status: 204 },
      });
      renderAt("/");
      await screen.findByRole("link", { name: "student (Konto)" });

      fireEvent.click(screen.getByRole("button", { name: "Abmelden" }));

      expect(await screen.findByRole("heading", { name: "Anmelden" })).toBeInTheDocument();
    });

    it("changes the language under Account, saves it on the account and switches at once", async () => {
      const fetchMock = mockApi({
        "GET /api/auth/me": { status: 200, body: { user: USER_EN } },
        "PUT /api/auth/language": { status: 200, body: { user: USER_DE } },
      });
      renderAt("/account");
      await findLoggedInAs("student");

      fireEvent.change(screen.getByLabelText("Interface language"), { target: { value: "de" } });

      expect(await screen.findByRole("heading", { name: "Konto" })).toBeInTheDocument();
      expect(sentBodies(fetchMock, "PUT", "/api/auth/language")).toEqual([{ language: "de" }]);
      expect(within(screen.getByRole("main")).getByLabelText("Sprache der Oberfläche")).toHaveValue("de");
      expect(window.localStorage.getItem("language")).toBe("de");
    });

    it("keeps the page language and says why when saving fails", async () => {
      mockApi({
        "GET /api/auth/me": { status: 200, body: { user: USER_EN } },
        "PUT /api/auth/language": { status: 500, body: { error: "internal_error" } },
      });
      renderAt("/account");
      await findLoggedInAs("student");

      fireEvent.change(screen.getByLabelText("Interface language"), { target: { value: "de" } });

      expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong on our side");
      expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    });

    it("formats the cooldown time for the language", async () => {
      const retry = new Date(Date.now() + 10 * 60_000).toISOString();
      mockApi({
        "GET /api/auth/me": { status: 200, body: { user: USER_DE } },
        "GET /api/overview": {
          status: 200,
          body: {
            course: { id: "c1", name: "INF24B" },
            modules: [{ id: "m1", name: "Datenbanken", semester: 3, counts: { free: 1, possible: 0, impossible: 0 }, myVote: "free", canChangeAt: retry }],
          },
        },
      });
      renderAt("/");

      expect(await screen.findByText(/Du kannst deine Stimme um \d\d:\d\d Uhr wieder ändern \(nur alle 15 Minuten\)/)).toBeInTheDocument();
    });
  });
});
