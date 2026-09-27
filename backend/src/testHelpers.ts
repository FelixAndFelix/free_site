import { sql } from "drizzle-orm";
import request from "supertest";
import { createAdminRouter } from "./admin/routes";
import { createApp } from "./app";
import { createAuthRouter } from "./auth/routes";
import type { Db } from "./database";
import type { Mail } from "./mail";
import { courses } from "./schema";

export const TEST_PASSWORD = "correct horse battery";
export const TEST_COURSE_CODE = "WS24-123";
export const TEST_SETUP_CODE = "setup-code-for-tests";

/**
 * Empties all tables and creates one course with TEST_COURSE_CODE.
 * @param {Db} db
 */
export async function resetDatabase(db: Db) {
  await db.execute(sql`truncate users, courses, email_codes, sessions cascade`);
  await db.insert(courses).values({ name: "WWI 2024", joinCode: TEST_COURSE_CODE });
}

/**
 * Builds the full app with captured mails and an injected clock.
 * @param {{db: Db, sentMails: Mail[], now: () => Date}} options
 */
export function createTestApp({ db, sentMails, now }: { db: Db; sentMails: Mail[]; now: () => Date }) {
  const authRouter = createAuthRouter({
    db,
    sendMail: async (mail) => void sentMails.push(mail),
    allowedEmailDomains: ["dhbw.example"],
    secureCookies: false,
    appUrl: "https://free.example",
    adminSetupCode: TEST_SETUP_CODE,
    now,
  });
  const adminRouter = createAdminRouter({ db, now });
  return createApp({ checkDatabase: async () => true, authRouter, adminRouter, trustProxy: "loopback" });
}

/**
 * Extracts the 6-digit code from the last mail sent.
 * @param {Mail[]} sentMails
 */
export function lastCode(sentMails: Mail[]): string {
  return /\d{6}/.exec(sentMails.at(-1)?.text ?? "")![0];
}

/**
 * Extracts the session cookie pair from a response.
 * @param {request.Response} response
 */
export function sessionCookie(response: request.Response): string {
  const cookies = response.headers["set-cookie"] as unknown as string[];
  return cookies.find((cookie) => cookie.startsWith("session="))!.split(";")[0]!;
}

/**
 * Registers a user through the API and returns its session cookie.
 * @param {ReturnType<typeof createApp>} app
 * @param {Mail[]} sentMails
 * The username defaults to the part of the email before the @.
 * @param {{email: string, username?: string, adminSetupCode?: string}} options
 */
export async function registerUser(
  app: ReturnType<typeof createApp>,
  sentMails: Mail[],
  { email, username = email.trim().split("@")[0]!, adminSetupCode }: { email: string; username?: string; adminSetupCode?: string },
): Promise<string> {
  await request(app)
    .post("/api/auth/register/start")
    .send({ email, username, courseCode: TEST_COURSE_CODE, adminSetupCode })
    .expect(202);
  const response = await request(app)
    .post("/api/auth/register/complete")
    .send({
      email,
      username,
      courseCode: TEST_COURSE_CODE,
      code: lastCode(sentMails),
      password: TEST_PASSWORD,
      adminSetupCode,
    })
    .expect(201);
  return sessionCookie(response);
}
