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
      subject: "is your FreeSite verification code",
      heading: "Confirm your email address",
      intro: "Enter this code on FreeSite to finish creating your account.",
      ignoreNote:
        "If you did not try to create an account, you can ignore this email. No account is created without the code.",
    },
    reset: {
      subject: "is your FreeSite password reset code",
      heading: "Reset your password",
      intro: "Enter this code on FreeSite to choose a new password.",
      ignoreNote: "If you did not ask to reset your password, you can ignore this email. Your password stays unchanged.",
    },
  },
  de: {
    register: {
      subject: "ist dein FreeSite-Bestätigungscode",
      heading: "Bestätige deine E-Mail-Adresse",
      intro: "Gib diesen Code auf FreeSite ein, um dein Konto zu erstellen.",
      ignoreNote:
        "Wenn du kein Konto erstellen wolltest, kannst du diese E-Mail ignorieren. Ohne den Code wird kein Konto angelegt.",
    },
    reset: {
      subject: "ist dein FreeSite-Code zum Zurücksetzen des Passworts",
      heading: "Passwort zurücksetzen",
      intro: "Gib diesen Code auf FreeSite ein, um ein neues Passwort zu wählen.",
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

// The mail follows the app's look (DESIGN.md): neutral greys, ink text and the three vote colors in
// the logo. Mail clients ignore most CSS, so the colors are inline; the <style> block only adds the
// dark variant for clients that honor prefers-color-scheme (Apple Mail, some Outlook and Gmail apps).
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO_STACK = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
const LIGHT = { page: "#eef0f3", card: "#ffffff", line: "#dde1e7", sunken: "#f5f6f8", ink: "#1d2230", body: "#474e5c", muted: "#5d6474" };

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
      `FreeSite · ${appUrl}`,
    ].join("\n"),
    html: renderCodeHtml({ content, texts, language, code, appUrl, host }),
  };
}

/**
 * The logo mark as table cells: three rounded bars of descending height in the vote colors.
 * Mail clients do not reliably render SVG, so the bars are plain boxes aligned to the bottom.
 */
function renderLogoMark(): string {
  const bar = (className: string, color: string, height: number, last = false) =>
    `<td valign="bottom" style="padding:0 ${last ? 0 : 4}px 0 0;"><div class="${className}" style="width:8px;height:${height}px;background:${color};border-radius:3px;font-size:0;line-height:0;">&nbsp;</div></td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>${bar("bar-free", "#15803d", 24)}${bar("bar-possible", "#e0a100", 16)}${bar("bar-impossible", "#dc2626", 10, true)}</tr></table>`;
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
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${content.heading}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .page { background:#0f1218 !important; }
    .card { background:#171b23 !important; border-color:#2a303c !important; }
    .ink { color:#e7e9ee !important; }
    .body { color:#c2c7d0 !important; }
    .muted { color:#9aa1ae !important; }
    .code { background:#1d222c !important; border-color:#2a303c !important; color:#e7e9ee !important; }
    .bar-free { background:#127c41 !important; }
    .bar-possible { background:#c28900 !important; }
    .bar-impossible { background:#d93b3b !important; }
  }
</style>
</head>
<body class="page" style="margin:0;padding:0;background:${LIGHT.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${texts.preview(code)}</div>
<table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT.page};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr>
          <td style="padding:0 4px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
              <td valign="bottom" style="padding-right:10px;">${renderLogoMark()}</td>
              <td valign="bottom" class="ink" style="font-family:${FONT_STACK};font-size:22px;line-height:24px;font-weight:700;letter-spacing:-0.5px;color:${LIGHT.ink};">FreeSite</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td class="card" style="background:${LIGHT.card};border:1px solid ${LIGHT.line};border-radius:12px;padding:32px 28px;font-family:${FONT_STACK};">
            <h1 class="ink" style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.2px;color:${LIGHT.ink};">${content.heading}</h1>
            <p class="body" style="margin:0 0 24px;font-size:16px;line-height:1.5;color:${LIGHT.body};">${content.intro}</p>
            <div class="code ink" style="margin:0 0 24px;padding:18px 0;background:${LIGHT.sunken};border:1px solid ${LIGHT.line};border-radius:8px;text-align:center;font-family:${MONO_STACK};font-size:32px;line-height:1.2;font-weight:700;letter-spacing:8px;color:${LIGHT.ink};">${code}</div>
            <p class="body" style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${LIGHT.body};">${texts.validityHtml}</p>
            <p class="muted" style="margin:0;font-size:14px;line-height:1.5;color:${LIGHT.muted};">${content.ignoreNote}</p>
          </td>
        </tr>
        <tr>
          <td class="muted" style="padding:16px 4px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${LIGHT.muted};">
            ${texts.sentBy(`<a href="${appUrl}" class="muted" style="color:${LIGHT.muted};">${host}</a>`)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
