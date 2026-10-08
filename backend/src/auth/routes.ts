import { Router, type Response } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import {
  DEFAULT_LANGUAGE,
  USERNAME_PATTERN,
  isLanguage,
  type AuthUser,
  type Language,
  type UserResponse,
} from "@free-site/shared";
import { createHash, timingSafeEqual } from "node:crypto";
import type { AuditLog } from "../audit/log";
import { isUniqueViolation, type Db } from "../database";
import { readBody, readFields, sendError } from "../http";
import type { SendMail } from "../mail";
import { buildCodeMail } from "../mailTemplates";
import { courseMembers, courses, users } from "../schema";
import { deleteAccount, isLastAdmin } from "./accounts";
import { consumeEmailCode, issueEmailCode } from "./emailCodes";
import { readSessionUser } from "./middleware";
import { hashPassword, isValidPassword, verifyPassword } from "./passwords";
import { createLoginThrottle, createWindowLimiter } from "./rateLimit";
import {
  SESSION_COOKIE,
  SESSION_LIFETIME_MS,
  createSession,
  deleteSession,
  deleteUserSessions,
} from "./sessions";

export interface AuthDependencies {
  db: Db;
  sendMail: SendMail;
  allowedEmailDomains: string[];
  secureCookies: boolean;
  appUrl: string;
  instanceLabel?: string;
  adminSetupCode?: string;
  /** Where sign-ins and account events are recorded. */
  audit: AuditLog;
  /** Told when an account is deleted, so live viewers of the course reload and streams close. */
  onAccountDeleted?: (userId: string, courseId: string | null) => void;
  now?: () => Date;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const SEND_CODE_LIMIT_PER_IP = 5;
// Caps the mails one address can receive, even from many IPs (at most one per minute anyway).
const CODE_MAILS_PER_ADDRESS_PER_HOUR = 5;
// Password spraying tries one password on many accounts, which the per-email throttle cannot see.
const FAILED_LOGINS_PER_IP = 20;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const USERNAME_CHANGES_PER_DAY = 10;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Reads the optional language of a request body; anything unsupported counts as the default.
 * @param {unknown} value
 */
function readLanguage(value: unknown): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

/**
 * Trims a username and returns it if it matches the username rules, otherwise null.
 * @param {string} username
 */
function normalizeUsername(username: string): string | null {
  const trimmed = username.trim();
  return USERNAME_PATTERN.test(trimmed) ? trimmed : null;
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
export function createAuthRouter({
  db,
  sendMail,
  allowedEmailDomains,
  secureCookies,
  appUrl,
  instanceLabel,
  adminSetupCode,
  audit,
  onAccountDeleted = () => {},
  now = () => new Date(),
}: AuthDependencies) {
  const router = Router();
  const sendCodeLimiter = createWindowLimiter({ limit: SEND_CODE_LIMIT_PER_IP, windowMs: HOUR_MS, now });
  const setupCodeLimiter = createWindowLimiter({ limit: SEND_CODE_LIMIT_PER_IP, windowMs: HOUR_MS, now });
  const loginThrottle = createLoginThrottle(now);
  const codeMailsPerAddress = createWindowLimiter({ limit: CODE_MAILS_PER_ADDRESS_PER_HOUR, windowMs: HOUR_MS, now });
  const failedLoginsPerIp = createWindowLimiter({ limit: FAILED_LOGINS_PER_IP, windowMs: FAILED_LOGIN_WINDOW_MS, now });
  const usernameChanges = createWindowLimiter({ limit: USERNAME_CHANGES_PER_DAY, windowMs: DAY_MS, now });

  /**
   * Issues a code and mails it, unless the address already got a code this minute or its hourly
   * maximum. Callers answer the same either way, so the response never reveals which case applied.
   */
  async function sendCodeMail(email: string, purpose: "register" | "reset", language: Language) {
    if (codeMailsPerAddress.isLimited(email)) return;
    const code = await issueEmailCode(db, email, purpose, now());
    if (!code) return;
    codeMailsPerAddress.hit(email);
    await sendMail(buildCodeMail({ to: email, purpose, code, appUrl, instanceLabel, language }));
  }

  /** True if the domain after the last @ is exactly one of the allowed domains. */
  function isAllowedDomain(email: string): boolean {
    return allowedEmailDomains.includes(email.slice(email.lastIndexOf("@") + 1));
  }

  /** Looks up a course by its join code, ignoring surrounding whitespace. */
  async function findCourseId(courseCode: string): Promise<string | null> {
    const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.joinCode, courseCode.trim()));
    return course?.id ?? null;
  }

  /** True if another user already has this username, ignoring upper and lower case. */
  async function isUsernameTaken(username: string, exceptUserId?: string): Promise<boolean> {
    const sameName = sql`lower(${users.username}) = lower(${username})`;
    const condition = exceptUserId ? and(sameName, ne(users.id, exceptUserId)) : sameName;
    const [existing] = await db.select({ id: users.id }).from(users).where(condition).limit(1);
    return existing !== undefined;
  }

  /** Looks up a user with password hash by normalized email. */
  async function findUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  /**
   * Classifies the optional setup code of a registration: "none" if absent, "valid" only if it
   * matches ADMIN_SETUP_CODE while no admin exists yet, otherwise "invalid".
   */
  async function checkSetupCode(provided: unknown): Promise<"none" | "valid" | "invalid"> {
    if (typeof provided !== "string" || provided.trim() === "") return "none";
    if (!adminSetupCode || !sameSecret(provided.trim(), adminSetupCode)) return "invalid";
    const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
    return admin ? "invalid" : "valid";
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
  function sendUser(response: Response, status: number, { id, email, username, role, language }: AuthUser) {
    const body: UserResponse = { user: { id, email, username, role, language } };
    response.status(status).json(body);
  }

  router.post("/register/start", async (request, response) => {
    if (!sendCodeLimiter.hit(request.ip ?? "unknown")) return sendError(response, 429, "rate_limited");
    const fields = readFields(request, ["email", "username", "courseCode"]);
    if (!fields) return sendError(response, 400, "invalid_request");
    const email = normalizeEmail(fields.email);
    if (!email) return sendError(response, 400, "invalid_email");
    if (!isAllowedDomain(email)) return sendError(response, 400, "email_domain_not_allowed");
    const username = normalizeUsername(fields.username);
    if (!username) return sendError(response, 400, "invalid_username");
    // Checked before the mail is sent so the user can pick another name right away.
    if (await isUsernameTaken(username)) return sendError(response, 409, "username_taken");
    if (!(await findCourseId(fields.courseCode))) return sendError(response, 400, "invalid_course_code");
    // Checked here, behind the per-IP limit, so the setup code cannot be brute-forced.
    if ((await checkSetupCode(readBody(request).adminSetupCode)) === "invalid") {
      return sendError(response, 400, "invalid_setup_code");
    }

    // Registered addresses get the same answer but no mail, so this does not reveal accounts.
    if (!(await findUserByEmail(email))) await sendCodeMail(email, "register", readLanguage(readBody(request).language));
    response.status(202).json({});
  });

  router.post("/register/complete", async (request, response) => {
    const fields = readFields(request, ["email", "username", "courseCode", "code", "password"]);
    if (!fields) return sendError(response, 400, "invalid_request");
    const email = normalizeEmail(fields.email);
    if (!email) return sendError(response, 400, "invalid_email");
    const username = normalizeUsername(fields.username);
    if (!username) return sendError(response, 400, "invalid_username");
    if (await isUsernameTaken(username)) return sendError(response, 409, "username_taken");
    if (!isValidPassword(fields.password)) return sendError(response, 400, "invalid_password");
    const courseId = await findCourseId(fields.courseCode);
    if (!courseId) return sendError(response, 400, "invalid_course_code");
    if (!(await consumeEmailCode(db, email, "register", fields.code.trim(), now()))) {
      return sendError(response, 400, "invalid_code");
    }
    // Checked after the email code is consumed, so every guess costs a new code.
    const setupCode = await checkSetupCode(readBody(request).adminSetupCode);
    if (setupCode === "invalid") return sendError(response, 400, "invalid_setup_code");

    const passwordHash = await hashPassword(fields.password);
    const role = setupCode === "valid" ? "admin" : "user";
    let user;
    try {
      user = await db.transaction(async (transaction) => {
        const [created] = await transaction
          .insert(users)
          .values({ email, username, passwordHash, role, language: readLanguage(readBody(request).language) })
          .returning();
        await transaction.insert(courseMembers).values({ courseId, userId: created!.id });
        return created!;
      });
    } catch (error) {
      // Someone took the username between the check above and this insert.
      if (isUniqueViolation(error)) return sendError(response, 409, "username_taken");
      throw error;
    }
    await startSession(response, user.id);
    await audit.record({ category: "access", action: "account.registered", actorUserId: user.id, email, ip: request.ip });
    sendUser(response, 201, user);
  });

  router.post("/login", async (request, response) => {
    const fields = readFields(request, ["email", "password"]);
    if (!fields) return sendError(response, 400, "invalid_request");
    const email = normalizeEmail(fields.email);
    if (!email) return sendError(response, 401, "invalid_credentials");
    const ip = request.ip ?? "unknown";
    if (loginThrottle.isBlocked(email) || failedLoginsPerIp.isLimited(ip)) return sendError(response, 429, "rate_limited");

    const user = await findUserByEmail(email);
    if (!(await verifyPassword(user?.passwordHash, fields.password)) || !user) {
      loginThrottle.recordFailure(email);
      failedLoginsPerIp.hit(ip);
      // The typed address is logged even if no account has it. Only failures that got past the rate
      // limits are logged, so an attacker cannot fill the log.
      await audit.record({ category: "access", action: "login.failed", targetUserId: user?.id, email, ip });
      return sendError(response, 401, "invalid_credentials");
    }
    loginThrottle.reset(email);
    await startSession(response, user.id);
    await audit.record({ category: "access", action: "login.succeeded", actorUserId: user.id, email, ip });
    sendUser(response, 200, user);
  });

  // Sets or changes the username; accounts from before usernames existed are asked for one after login.
  router.put("/username", async (request, response) => {
    const user = await readSessionUser(db, request, now());
    if (!user) return sendError(response, 401, "unauthenticated");
    const fields = readFields(request, ["username"]);
    if (!fields) return sendError(response, 400, "invalid_request");
    const username = normalizeUsername(fields.username);
    if (!username) return sendError(response, 400, "invalid_username");
    if (await isUsernameTaken(username, user.id)) return sendError(response, 409, "username_taken");
    // Stops a script from cycling through names (e.g. to impersonate others one after another).
    if (!usernameChanges.hit(user.id)) return sendError(response, 429, "rate_limited");
    try {
      await db.update(users).set({ username }).where(eq(users.id, user.id));
    } catch (error) {
      if (isUniqueViolation(error)) return sendError(response, 409, "username_taken");
      throw error;
    }
    sendUser(response, 200, { ...user, username });
  });

  // The interface language belongs to the account, so it follows the user to every device.
  router.put("/language", async (request, response) => {
    const user = await readSessionUser(db, request, now());
    if (!user) return sendError(response, 401, "unauthenticated");
    const language = readBody(request).language;
    if (!isLanguage(language)) return sendError(response, 400, "invalid_request");
    await db.update(users).set({ language }).where(eq(users.id, user.id));
    sendUser(response, 200, { ...user, language });
  });

  // For accounts registered before the first admin existed; same rules as at registration.
  router.post("/claim-admin", async (request, response) => {
    if (!setupCodeLimiter.hit(request.ip ?? "unknown")) return sendError(response, 429, "rate_limited");
    const user = await readSessionUser(db, request, now());
    if (!user) return sendError(response, 401, "unauthenticated");
    if ((await checkSetupCode(readBody(request).adminSetupCode)) !== "valid") {
      return sendError(response, 400, "invalid_setup_code");
    }
    await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    await audit.record({ category: "access", action: "admin.claimed", actorUserId: user.id, email: user.email, ip: request.ip });
    sendUser(response, 200, { ...user, role: "admin" });
  });

  // Deleting needs the password again, so an open session on a shared computer is not enough.
  // Wrong passwords count towards the same per-email throttle as logins.
  router.delete("/account", async (request, response) => {
    const sessionUser = await readSessionUser(db, request, now());
    if (!sessionUser) return sendError(response, 401, "unauthenticated");
    const fields = readFields(request, ["password"]);
    if (!fields) return sendError(response, 400, "invalid_request");
    if (loginThrottle.isBlocked(sessionUser.email)) return sendError(response, 429, "rate_limited");
    const user = await findUserByEmail(sessionUser.email);
    if (!user || !(await verifyPassword(user.passwordHash, fields.password))) {
      loginThrottle.recordFailure(sessionUser.email);
      return sendError(response, 401, "invalid_credentials");
    }
    // Without any admin nobody could manage courses; the setup code would work again, but only
    // for whoever registers first, so the last admin has to promote someone before leaving.
    if (await isLastAdmin(db, user.id)) return sendError(response, 409, "last_admin");

    const courseId = await deleteAccount(db, { userId: user.id, now: now() });
    // The account is gone, so no user is linked; the address and email show whose account it was.
    await audit.record({ category: "access", action: "account.deleted", email: sessionUser.email, ip: request.ip });
    loginThrottle.reset(sessionUser.email);
    onAccountDeleted(user.id, courseId);
    response.clearCookie(SESSION_COOKIE, { path: "/" });
    response.status(204).end();
  });

  router.post("/logout", async (request, response) => {
    const token: unknown = request.cookies?.[SESSION_COOKIE];
    if (typeof token === "string") await deleteSession(db, token);
    response.clearCookie(SESSION_COOKIE, { path: "/" });
    response.status(204).end();
  });

  router.get("/me", async (request, response) => {
    const user = await readSessionUser(db, request, now());
    if (!user) return sendError(response, 401, "unauthenticated");
    sendUser(response, 200, user);
  });

  router.post("/reset/start", async (request, response) => {
    if (!sendCodeLimiter.hit(request.ip ?? "unknown")) return sendError(response, 429, "rate_limited");
    const fields = readFields(request, ["email"]);
    if (!fields) return sendError(response, 400, "invalid_request");
    const email = normalizeEmail(fields.email);
    if (!email) return sendError(response, 400, "invalid_email");

    const account = await findUserByEmail(email);
    if (account) {
      // The language the visitor reads the page in wins; without one the mail follows the account.
      const requested = readBody(request).language;
      const language = isLanguage(requested) ? requested : account.language;
      // A failed send is logged, not returned, so the response never depends on the account existing.
      await sendCodeMail(email, "reset", language).catch((error: unknown) => console.error("reset mail failed", error));
    }
    // Logged for unknown addresses too (the response is the same either way); bounded by the per-IP limit above.
    await audit.record({ category: "access", action: "password_reset.requested", targetUserId: account?.id, email, ip: request.ip });
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
    await audit.record({ category: "access", action: "password_reset.completed", actorUserId: user.id, email, ip: request.ip });
    response.status(204).end();
  });

  return router;
}

/**
 * Compares two secrets in constant time, regardless of their lengths.
 * @param {string} provided
 * @param {string} expected
 */
function sameSecret(provided: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}
