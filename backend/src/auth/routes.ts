import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import type { ApiErrorCode, AuthUser, UserResponse } from "@free-site/shared";
import type { Db } from "../database";
import type { SendMail } from "../mail";
import { courseMembers, courses, users } from "../schema";
import { consumeEmailCode, issueEmailCode } from "./emailCodes";
import { hashPassword, isValidPassword, verifyPassword } from "./passwords";
import { createLoginThrottle, createWindowLimiter } from "./rateLimit";
import {
  SESSION_COOKIE,
  SESSION_LIFETIME_MS,
  createSession,
  deleteSession,
  deleteUserSessions,
  findSessionUser,
} from "./sessions";

export interface AuthDependencies {
  db: Db;
  sendMail: SendMail;
  allowedEmailDomains: string[];
  secureCookies: boolean;
  now?: () => Date;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const SEND_CODE_LIMIT_PER_IP = 5;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Sends a JSON error body with the given status.
 * @param {Response} response
 * @param {number} status
 * @param {ApiErrorCode} error
 */
function sendError(response: Response, status: number, error: ApiErrorCode) {
  response.status(status).json({ error });
}

/**
 * Returns the named string fields of the request body, or null if any is missing.
 * @param {Request} request
 * @param {string[]} keys
 */
function readFields<K extends string>(request: Request, keys: K[]): Record<K, string> | null {
  const body: unknown = request.body;
  if (typeof body !== "object" || body === null) return null;
  const fields = body as Record<string, unknown>;
  return keys.every((key) => typeof fields[key] === "string") ? (fields as Record<K, string>) : null;
}

/**
 * Trims and lowercases an email, or returns null if it is not shaped like one.
 * @param {string} email
 */
function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) && normalized.length <= 254 ? normalized : null;
}

/**
 * Builds the /api/auth router: registration, login, logout, current user and password reset.
 * @param {AuthDependencies} dependencies
 */
export function createAuthRouter({ db, sendMail, allowedEmailDomains, secureCookies, now = () => new Date() }: AuthDependencies) {
  const router = Router();
  const sendCodeLimiter = createWindowLimiter({ limit: SEND_CODE_LIMIT_PER_IP, windowMs: HOUR_MS, now });
  const loginThrottle = createLoginThrottle(now);

  /** True if the domain after the last @ is exactly one of the allowed domains. */
  function isAllowedDomain(email: string): boolean {
    return allowedEmailDomains.includes(email.slice(email.lastIndexOf("@") + 1));
  }

  /** Looks up a course by its join code, ignoring surrounding whitespace. */
  async function findCourseId(courseCode: string): Promise<string | null> {
    const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.joinCode, courseCode.trim()));
    return course?.id ?? null;
  }

  /** Looks up a user with password hash by normalized email. */
  async function findUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  /** Starts a session and sets its cookie on the response. */
  async function startSession(response: Response, userId: string) {
    const token = await createSession(db, userId, now());
    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_LIFETIME_MS,
    });
  }

  /** Sends the user back as the response body. */
  function sendUser(response: Response, status: number, { id, email, role }: AuthUser) {
    const body: UserResponse = { user: { id, email, role } };
    response.status(status).json(body);
  }

  router.post("/register/start", async (request, response) => {
    if (!sendCodeLimiter.hit(request.ip ?? "unknown")) return sendError(response, 429, "rate_limited");
    const fields = readFields(request, ["email", "courseCode"]);
    if (!fields) return sendError(response, 400, "invalid_request");
    const email = normalizeEmail(fields.email);
    if (!email) return sendError(response, 400, "invalid_email");
    if (!isAllowedDomain(email)) return sendError(response, 400, "email_domain_not_allowed");
    if (!(await findCourseId(fields.courseCode))) return sendError(response, 400, "invalid_course_code");

    // Registered addresses get the same answer but no mail, so this does not reveal accounts.
    if (!(await findUserByEmail(email))) {
      const code = await issueEmailCode(db, email, "register", now());
      if (code) {
        await sendMail({
          to: email,
          subject: "Your free_site verification code",
          text: `Your verification code is ${code}. It is valid for 10 minutes.`,
        });
      }
    }
    response.status(202).json({});
  });

  router.post("/register/complete", async (request, response) => {
    const fields = readFields(request, ["email", "courseCode", "code", "password"]);
    if (!fields) return sendError(response, 400, "invalid_request");
    const email = normalizeEmail(fields.email);
    if (!email) return sendError(response, 400, "invalid_email");
    if (!isValidPassword(fields.password)) return sendError(response, 400, "invalid_password");
    const courseId = await findCourseId(fields.courseCode);
    if (!courseId) return sendError(response, 400, "invalid_course_code");
    if (!(await consumeEmailCode(db, email, "register", fields.code.trim(), now()))) {
      return sendError(response, 400, "invalid_code");
    }

    const passwordHash = await hashPassword(fields.password);
    const user = await db.transaction(async (transaction) => {
      const [created] = await transaction.insert(users).values({ email, passwordHash }).returning();
      await transaction.insert(courseMembers).values({ courseId, userId: created!.id });
      return created!;
    });
    await startSession(response, user.id);
    sendUser(response, 201, user);
  });

  router.post("/login", async (request, response) => {
    const fields = readFields(request, ["email", "password"]);
    if (!fields) return sendError(response, 400, "invalid_request");
    const email = normalizeEmail(fields.email);
    if (!email) return sendError(response, 401, "invalid_credentials");
    if (loginThrottle.isBlocked(email)) return sendError(response, 429, "rate_limited");

    const user = await findUserByEmail(email);
    if (!(await verifyPassword(user?.passwordHash, fields.password)) || !user) {
      loginThrottle.recordFailure(email);
      return sendError(response, 401, "invalid_credentials");
    }
    loginThrottle.reset(email);
    await startSession(response, user.id);
    sendUser(response, 200, user);
  });

  router.post("/logout", async (request, response) => {
    const token: unknown = request.cookies?.[SESSION_COOKIE];
    if (typeof token === "string") await deleteSession(db, token);
    response.clearCookie(SESSION_COOKIE, { path: "/" });
    response.status(204).end();
  });

  router.get("/me", async (request, response) => {
    const token: unknown = request.cookies?.[SESSION_COOKIE];
    const user = typeof token === "string" ? await findSessionUser(db, token, now()) : null;
    if (!user) return sendError(response, 401, "unauthenticated");
    sendUser(response, 200, user);
  });

  router.post("/reset/start", async (request, response) => {
    if (!sendCodeLimiter.hit(request.ip ?? "unknown")) return sendError(response, 429, "rate_limited");
    const fields = readFields(request, ["email"]);
    if (!fields) return sendError(response, 400, "invalid_request");
    const email = normalizeEmail(fields.email);
    if (!email) return sendError(response, 400, "invalid_email");

    if (await findUserByEmail(email)) {
      const code = await issueEmailCode(db, email, "reset", now());
      if (code) {
        // A failed send is logged, not returned, so the response never depends on the account existing.
        await sendMail({
          to: email,
          subject: "Your free_site password reset code",
          text: `Your password reset code is ${code}. It is valid for 10 minutes.`,
        }).catch((error: unknown) => console.error("reset mail failed", error));
      }
    }
    response.status(202).json({});
  });

  router.post("/reset/complete", async (request, response) => {
    const fields = readFields(request, ["email", "code", "password"]);
    if (!fields) return sendError(response, 400, "invalid_request");
    const email = normalizeEmail(fields.email);
    if (!email) return sendError(response, 400, "invalid_email");
    if (!isValidPassword(fields.password)) return sendError(response, 400, "invalid_password");
    const user = await findUserByEmail(email);
    if (!user || !(await consumeEmailCode(db, email, "reset", fields.code.trim(), now()))) {
      return sendError(response, 400, "invalid_code");
    }

    await db.update(users).set({ passwordHash: await hashPassword(fields.password) }).where(eq(users.id, user.id));
    await deleteUserSessions(db, user.id);
    loginThrottle.reset(email);
    response.status(204).end();
  });

  return router;
}
