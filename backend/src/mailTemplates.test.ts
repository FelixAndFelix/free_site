import { describe, expect, it } from "vitest";
import { buildCodeMail } from "./mailTemplates";

const APP_URL = "https://free.felixkarg.de";

describe("buildCodeMail", () => {
  it("leads the subject with the code", () => {
    const mail = buildCodeMail({ to: "a@dhbw.example", purpose: "register", code: "042137", appUrl: APP_URL });

    expect(mail.to).toBe("a@dhbw.example");
    expect(mail.subject).toBe("042137 is your free_site verification code");
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
});
