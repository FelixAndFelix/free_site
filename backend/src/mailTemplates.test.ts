import { describe, expect, it } from "vitest";
import { buildCodeMail } from "./mailTemplates";

const APP_URL = "https://free.felixkarg.de";

describe("buildCodeMail", () => {
  it("leads the subject with the code", () => {
    const mail = buildCodeMail({ to: "a@dhbw.example", purpose: "register", code: "042137", appUrl: APP_URL });

    expect(mail.to).toBe("a@dhbw.example");
    expect(mail.subject).toBe("042137 is your free_site verification code");
  });

  it("marks mails of a non-production instance in the subject", () => {
    const mail = buildCodeMail({ to: "a@dhbw.example", purpose: "register", code: "042137", appUrl: APP_URL, instanceLabel: "Development" });

    expect(mail.subject).toBe("042137 is your free_site verification code (Development)");
  });

  it("puts the code into both the HTML and the plain-text body", () => {
    const mail = buildCodeMail({ to: "a@dhbw.example", purpose: "reset", code: "042137", appUrl: APP_URL });

    expect(mail.text).toContain("042137");
    expect(mail.html).toContain("042137");
    expect(mail.text).toContain("Reset your password");
    expect(mail.html).toContain(`href="${APP_URL}"`);
  });

  it("uses different wording for registration and reset", () => {
    const register = buildCodeMail({ to: "a@dhbw.example", purpose: "register", code: "1", appUrl: APP_URL });
    const reset = buildCodeMail({ to: "a@dhbw.example", purpose: "reset", code: "1", appUrl: APP_URL });

    expect(register.html).toContain("Confirm your email address");
    expect(reset.html).not.toContain("Confirm your email address");
  });

  describe("in German", () => {
    it("writes subject, text and HTML in German", () => {
      const mail = buildCodeMail({ to: "a@dhbw.example", purpose: "register", code: "042137", appUrl: APP_URL, language: "de" });

      expect(mail.subject).toBe("042137 ist dein free_site-Bestätigungscode");
      expect(mail.text).toContain("Bestätige deine E-Mail-Adresse");
      expect(mail.text).toContain("Der Code ist 10 Minuten gültig und kann einmal verwendet werden.");
      expect(mail.html).toContain('<html lang="de">');
      expect(mail.html).toContain("Dein Code ist 042137. Er ist 10 Minuten gültig.");
      expect(mail.html).toContain("Gesendet von");
      expect(mail.html).not.toContain("Confirm your email address");
    });

    it("keeps the instance label and uses the reset wording", () => {
      const mail = buildCodeMail({ to: "a@dhbw.example", purpose: "reset", code: "1", appUrl: APP_URL, instanceLabel: "Development", language: "de" });

      expect(mail.subject).toBe("1 ist dein free_site-Code zum Zurücksetzen des Passworts (Development)");
      expect(mail.html).toContain("Passwort zurücksetzen");
    });
  });
});
