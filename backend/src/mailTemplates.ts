import { DEFAULT_LANGUAGE, type Language } from "@free-site/shared";
import type { Mail } from "./mail";

export type CodeMailPurpose = "register" | "reset";

interface CodeMailContent {
  subject: string;
  heading: string;
  intro: string;
  ignoreNote: string;
}

/** Wording that does not depend on the purpose of the mail. */
interface MailTexts {
  /** The plain-text line after the code. */
  validity: string;
  /** The same sentence as HTML, with the duration in bold. */
  validityHtml: string;
  /** Preview text shown by mail apps next to the subject; takes the code. */
  preview: (code: string) => string;
  /** The footer; takes the linked host name. */
  sentBy: (hostLink: string) => string;
}

const CONTENT: Record<Language, Record<CodeMailPurpose, CodeMailContent>> = {
  en: {
    register: {
      subject: "is your free_site verification code",
      heading: "Confirm your email address",
      intro: "Enter this code on free_site to finish creating your account.",
      ignoreNote:
        "If you did not try to create an account, you can ignore this email. No account is created without the code.",
    },
    reset: {
      subject: "is your free_site password reset code",
      heading: "Reset your password",
      intro: "Enter this code on free_site to choose a new password.",
      ignoreNote: "If you did not ask to reset your password, you can ignore this email. Your password stays unchanged.",
    },
  },
  de: {
    register: {
      subject: "ist dein free_site-Bestätigungscode",
      heading: "Bestätige deine E-Mail-Adresse",
      intro: "Gib diesen Code auf free_site ein, um dein Konto zu erstellen.",
      ignoreNote:
        "Wenn du kein Konto erstellen wolltest, kannst du diese E-Mail ignorieren. Ohne den Code wird kein Konto angelegt.",
    },
    reset: {
      subject: "ist dein free_site-Code zum Zurücksetzen des Passworts",
      heading: "Passwort zurücksetzen",
      intro: "Gib diesen Code auf free_site ein, um ein neues Passwort zu wählen.",
      ignoreNote:
        "Wenn du dein Passwort nicht zurücksetzen wolltest, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.",
    },
  },
};

const TEXTS: Record<Language, MailTexts> = {
  en: {
    validity: "The code is valid for 10 minutes and can be used once.",
    validityHtml: "The code is valid for <strong>10 minutes</strong> and can be used once.",
    preview: (code) => `Your code is ${code}. It is valid for 10 minutes.`,
    sentBy: (hostLink) =>
      `Sent by ${hostLink}, the module vote for DHBW students. This is an automated message; replies are not read.`,
  },
  de: {
    validity: "Der Code ist 10 Minuten gültig und kann einmal verwendet werden.",
    validityHtml: "Der Code ist <strong>10 Minuten</strong> gültig und kann einmal verwendet werden.",
    preview: (code) => `Dein Code ist ${code}. Er ist 10 Minuten gültig.`,
    sentBy: (hostLink) =>
      `Gesendet von ${hostLink}, der Modul-Abstimmung für DHBW-Studierende. Dies ist eine automatische Nachricht; Antworten werden nicht gelesen.`,
  },
};

const BRAND_COLOR = "#166534";
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Builds the verification or reset code mail as HTML with a plain-text fallback.
 * The code leads the subject so it is readable straight from a phone notification.
 * An instance label (e.g. "Development") is appended to the subject, so test mails stand out.
 * @param {{to: string, purpose: CodeMailPurpose, code: string, appUrl: string, instanceLabel?: string, language?: Language}} options
 *   language: the language of the whole mail, English by default
 */
export function buildCodeMail({
  to,
  purpose,
  code,
  appUrl,
  instanceLabel,
  language = DEFAULT_LANGUAGE,
}: {
  to: string;
  purpose: CodeMailPurpose;
  code: string;
  appUrl: string;
  instanceLabel?: string;
  language?: Language;
}): Mail {
  const content = CONTENT[language][purpose];
  const texts = TEXTS[language];
  const host = new URL(appUrl).host;
  return {
    to,
    subject: `${code} ${content.subject}${instanceLabel ? ` (${instanceLabel})` : ""}`,
    text: [
      content.heading,
      "",
      content.intro,
      "",
      `    ${code}`,
      "",
      texts.validity,
      "",
      content.ignoreNote,
      "",
      "--",
      `free_site · ${appUrl}`,
    ].join("\n"),
    html: renderCodeHtml({ content, texts, language, code, appUrl, host }),
  };
}

/**
 * Renders the HTML body. Email clients ignore stylesheets and flexbox, so the layout
 * uses tables and inline styles only. All interpolated values are app-controlled.
 * @param {{content: CodeMailContent, texts: MailTexts, language: Language, code: string, appUrl: string, host: string}} options
 */
function renderCodeHtml({
  content,
  texts,
  language,
  code,
  appUrl,
  host,
}: {
  content: CodeMailContent;
  texts: MailTexts;
  language: Language;
  code: string;
  appUrl: string;
  host: string;
}): string {
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${content.heading}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${texts.preview(code)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr>
          <td style="padding:0 4px 16px;font-family:${FONT_STACK};font-size:20px;font-weight:700;color:${BRAND_COLOR};">free_site</td>
        </tr>
        <tr>
          <td style="background:#ffffff;border-radius:12px;padding:32px 28px;font-family:${FONT_STACK};color:#18181b;">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;">${content.heading}</h1>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#3f3f46;">${content.intro}</p>
            <div style="margin:0 0 24px;padding:18px 0;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:center;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND_COLOR};">${code}</div>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#52525b;">${texts.validityHtml}</p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#71717a;">${content.ignoreNote}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 4px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:#a1a1aa;">
            ${texts.sentBy(`<a href="${appUrl}" style="color:#71717a;">${host}</a>`)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
