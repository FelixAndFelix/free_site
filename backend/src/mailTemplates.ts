import type { Mail } from "./mail";

export type CodeMailPurpose = "register" | "reset";

interface CodeMailContent {
  subject: string;
  heading: string;
  intro: string;
  ignoreNote: string;
}

const CONTENT: Record<CodeMailPurpose, CodeMailContent> = {
  register: {
    subject: "is your free_site verification code",
    heading: "Confirm your email address",
    intro: "Enter this code on free_site to finish creating your account.",
    ignoreNote: "If you did not try to create an account, you can ignore this email. No account is created without the code.",
  },
  reset: {
    subject: "is your free_site password reset code",
    heading: "Reset your password",
    intro: "Enter this code on free_site to choose a new password.",
    ignoreNote: "If you did not ask to reset your password, you can ignore this email. Your password stays unchanged.",
  },
};

const BRAND_COLOR = "#166534";
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Builds the verification or reset code mail as HTML with a plain-text fallback.
 * The code leads the subject so it is readable straight from a phone notification.
 * @param {{to: string, purpose: CodeMailPurpose, code: string, appUrl: string}} options
 */
export function buildCodeMail({ to, purpose, code, appUrl }: { to: string; purpose: CodeMailPurpose; code: string; appUrl: string }): Mail {
  const content = CONTENT[purpose];
  const host = new URL(appUrl).host;
  return {
    to,
    subject: `${code} ${content.subject}`,
    text: [
      content.heading,
      "",
      content.intro,
      "",
      `    ${code}`,
      "",
      "The code is valid for 10 minutes and can be used once.",
      "",
      content.ignoreNote,
      "",
      "--",
      `free_site · ${appUrl}`,
    ].join("\n"),
    html: renderCodeHtml(content, code, appUrl, host),
  };
}

/**
 * Renders the HTML body. Email clients ignore stylesheets and flexbox, so the layout
 * uses tables and inline styles only. All interpolated values are app-controlled.
 * @param {CodeMailContent} content
 * @param {string} code
 * @param {string} appUrl
 * @param {string} host
 */
function renderCodeHtml(content: CodeMailContent, code: string, appUrl: string, host: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${content.heading}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your code is ${code}. It is valid for 10 minutes.</div>
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
            <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#52525b;">The code is valid for <strong>10 minutes</strong> and can be used once.</p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#71717a;">${content.ignoreNote}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 4px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:#a1a1aa;">
            Sent by <a href="${appUrl}" style="color:#71717a;">${host}</a>, the module vote for DHBW students. This is an automated message; replies are not read.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
