export interface Config {
  port: number;
  databaseUrl: string;
  isProduction: boolean;
  allowedEmailDomains: string[];
  trustProxy: string;
  resendApiKey: string | undefined;
  mailFrom: string;
}

/**
 * Reads the backend configuration from environment variables.
 * @param {NodeJS.ProcessEnv} env
 */
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl: env.DATABASE_URL ?? "",
    isProduction: env.NODE_ENV === "production",
    allowedEmailDomains: parseList(env.ALLOWED_EMAIL_DOMAINS),
    // Private and loopback hops (nginx, reverse proxy, tunnel) are trusted, so req.ip is the real client.
    trustProxy: env.TRUST_PROXY ?? "loopback, linklocal, uniquelocal",
    resendApiKey: env.RESEND_API_KEY || undefined,
    mailFrom: env.MAIL_FROM ?? "free_site <no-reply@felixkarg.de>",
  };
}

/**
 * Splits a comma-separated env value into lowercased, trimmed entries.
 * @param {string | undefined} value
 */
function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}
