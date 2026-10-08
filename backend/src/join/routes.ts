import { Router, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import type { AuthUser, JoinInfoResponse, JoinResponse } from "@free-site/shared";
import { createWindowLimiter } from "../auth/rateLimit";
import { readSessionUser, requireRole } from "../auth/middleware";
import type { Db } from "../database";
import { readBody, sendError } from "../http";
import { courseMembers, courses } from "../schema";
import type { EventHub } from "../voting/events";
import { withdrawVotesOutsideCourse } from "../voting/votes";

export interface JoinDependencies {
  db: Db;
  events: EventHub;
  now?: () => Date;
}

// Only look-ups of unknown codes count, so a class opening the same valid link from one campus
// network is never limited, while guessing codes is.
const FAILED_LOOKUPS_PER_IP = 20;
const FAILED_LOOKUP_WINDOW_MS = 15 * 60 * 1000;

/**
 * Builds the /api/join router behind invite links (/join/<course join code>): a public look-up of
 * the course name and, for logged-in users, joining the course or switching to it.
 * @param {JoinDependencies} dependencies
 */
export function createJoinRouter({ db, events, now = () => new Date() }: JoinDependencies) {
  const router = Router();
  const failedLookups = createWindowLimiter({
    limit: FAILED_LOOKUPS_PER_IP,
    windowMs: FAILED_LOOKUP_WINDOW_MS,
    now,
  });

  /** Returns the course with this join code, or null. */
  async function findCourse(code: string | undefined) {
    if (!code) return null;
    const [course] = await db
      .select({ id: courses.id, name: courses.name })
      .from(courses)
      .where(eq(courses.joinCode, code.trim()));
    return course ?? null;
  }

  /** Returns the course the user is in, or null. */
  async function findMembership(userId: string) {
    const [course] = await db
      .select({ id: courses.id, name: courses.name })
      .from(courseMembers)
      .innerJoin(courses, eq(courses.id, courseMembers.courseId))
      .where(eq(courseMembers.userId, userId));
    return course ?? null;
  }

  /**
   * Looks up the course of a code for a request. Answers 429 when the client guessed too often
   * and 404 for an unknown code; returns the course only when neither applies.
   */
  async function lookUp(request: Request, response: Response) {
    if (failedLookups.isLimited(request.ip ?? "unknown")) {
      sendError(response, 429, "rate_limited");
      return null;
    }
    const code = request.params.code;
    const course = await findCourse(typeof code === "string" ? code : undefined);
    if (!course) {
      failedLookups.hit(request.ip ?? "unknown");
      sendError(response, 404, "not_found");
      return null;
    }
    return course;
  }

  router.get("/:code", async (request, response) => {
    const course = await lookUp(request, response);
    if (!course) return;
    const body: JoinInfoResponse = { course: { name: course.name } };
    const user = await readSessionUser(db, request, now());
    if (user) {
      const current = await findMembership(user.id);
      body.membership = !current ? "none" : current.id === course.id ? "same" : "other";
      if (current && current.id !== course.id) body.currentCourseName = current.name;
    }
    response.json(body);
  });

  router.post("/:code", requireRole({ db, role: "user", now }), async (request, response) => {
    const course = await lookUp(request, response);
    if (!course) return;
    const user = response.locals.user as AuthUser;
    const confirmSwitch = readBody(request).confirmSwitch === true;
    const result: JoinResponse = { course };

    const previousCourseId = await db.transaction(async (transaction) => {
      // Serialises concurrent joins of one user, so they never end up in two courses.
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`join:${user.id}`}))`);
      const [current] = await transaction
        .select({ courseId: courseMembers.courseId })
        .from(courseMembers)
        .where(eq(courseMembers.userId, user.id));
      if (current?.courseId === course.id) return "same" as const;
      if (current && !confirmSwitch) return "needs-confirmation" as const;
      await transaction.delete(courseMembers).where(eq(courseMembers.userId, user.id));
      await transaction.insert(courseMembers).values({ courseId: course.id, userId: user.id });
      return current?.courseId ?? null;
    });

    if (previousCourseId === "needs-confirmation") return sendError(response, 409, "already_in_course");
    if (previousCourseId !== "same") {
      // Votes only count in the voter's course, so votes on the old course's modules are withdrawn.
      await withdrawVotesOutsideCourse(db, { userId: user.id, courseId: course.id, now: now() });
      events.userLeftCourse(user.id, previousCourseId);
    }
    response.json(result);
  });

  return router;
}
