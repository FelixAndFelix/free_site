export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type SendMail = (mail: Mail) => Promise<void>;

interface MailConfig {
  isProduction: boolean;
  resendApiKey: string | undefined;
  mailFrom: string;
}

/**
 * Returns the single sendMail function of the app: Resend when an API key is set,
 * otherwise a console logger for local development.
 * @param {MailConfig} config
 */
export function createSendMail({ isProduction, resendApiKey, mailFrom }: MailConfig): SendMail {
  if (resendApiKey) return createResendSendMail(resendApiKey, mailFrom);
  if (isProduction) throw new Error("RESEND_API_KEY must be set in production");
  return async (mail) => console.log(`[mail] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
}

/**
 * Sends mail through the Resend HTTP API.
 * @param {string} apiKey
 * @param {string} from
 */
function createResendSendMail(apiKey: string, from: string): SendMail {
  return async ({ to, subject, text, html }) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, html }),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}`);
  };
}
