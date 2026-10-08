import { sql } from "drizzle-orm";
import request from "supertest";
import { createAdminRouter } from "./admin/routes";
import { createAuditLog, type AuditLog } from "./audit/log";
import { createApp } from "./app";
import { createJoinRouter } from "./join/routes";
import { createAuthRouter } from "./auth/routes";
import type { Db } from "./database";
import type { Mail } from "./mail";
import { courses } from "./schema";
import { createEventHub, type EventHub } from "./voting/events";
import { createVotingRouter } from "./voting/routes";

export const TEST_PASSWORD = "correct horse battery";
export const TEST_COURSE_CODE = "WS24-123";
export const TEST_SETUP_CODE = "setup-code-for-tests";

/**
 * Empties all tables and creates one course with TEST_COURSE_CODE.
 * @param {Db} db
 */
export async function resetDatabase(db: Db) {
  await db.execute(sql`truncate users, courses, email_codes, sessions, audit_log cascade`);
  await db.insert(courses).values({ name: "WWI 2024", joinCode: TEST_COURSE_CODE });
}

/**
 * Builds the full app with captured mails and an injected clock.
 * @param {{db: Db, sentMails: Mail[], now: () => Date, events?: EventHub}} options
 */
export function createTestApp({
  db,
  sentMails,
  now,
  events = createEventHub(),
  audit = createAuditLog(db, now),
}: {
  db: Db;
  sentMails: Mail[];
  now: () => Date;
  events?: EventHub;
  audit?: AuditLog;
}) {
  const authRouter = createAuthRouter({
    db,
    sendMail: async (mail) => void sentMails.push(mail),
    allowedEmailDomains: ["dhbw.example"],
    secureCookies: false,
    appUrl: "https://free.example",
    adminSetupCode: TEST_SETUP_CODE,
    onAccountDeleted: events.userLeftCourse,
    audit,
    now,
  });
  const adminRouter = createAdminRouter({ db, events, audit, now });
  const joinRouter = createJoinRouter({ db, events, audit, now });
  const votingRouter = createVotingRouter({ db, events, now });
  return createApp({
    checkDatabase: async () => true,
    authRouter,
    adminRouter,
    joinRouter,
    votingRouter,
    trustProxy: "loopback",
  });
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
