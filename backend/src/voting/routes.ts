import { Router, type Response } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  GRADE_MAX,
  GRADE_MIN,
  MIN_GRADES_SHOWN,
  VOTE_VALUES,
  type ApiError,
  type AuthUser,
  type ModuleDetailResponse,
  type ModuleOverview,
  type ModuleOverviewResponse,
  type OverviewResponse,
  type VoteValue,
} from "@free-site/shared";
import { requireRole } from "../auth/middleware";
import type { Db } from "../database";
import { isUuid, readBody, sendError } from "../http";
import { courseMembers, courses, grades, modules, votes } from "../schema";
import { loadVoteHistory } from "./history";
import type { EventHub } from "./events";
import { changeVote, cooldownEnd } from "./votes";

export interface VotingDependencies {
  db: Db;
  events: EventHub;
  now?: () => Date;
}

/**
 * Admins may change their vote at any time, e.g. to try things out; the cooldown only limits users.
 * @param {AuthUser} user
 */
function isExemptFromCooldown(user: AuthUser): boolean {
  return user.role === "admin";
}

/**
 * Builds the voting router: the overview of the user's course and casting, changing
 * or withdrawing the user's vote on a module. Logged-in users only.
 * @param {VotingDependencies} dependencies
 */
export function createVotingRouter({ db, events, now = () => new Date() }: VotingDependencies) {
  const router = Router();
  router.use(requireRole({ db, role: "user", now }));

  /** Returns the course the user belongs to, or null. */
  async function findUserCourse(userId: string) {
    const [course] = await db
      .select({ id: courses.id, name: courses.name })
      .from(courseMembers)
      .innerJoin(courses, eq(courses.id, courseMembers.courseId))
      .where(eq(courseMembers.userId, userId));
    return course ?? null;
  }

  /**
   * Loads modules of a course with their vote counts and the user's own vote.
   * Table names are written out in sql`` because Drizzle leaves columns unqualified there.
   */
  async function loadOverview(courseId: string, user: AuthUser, moduleId?: string): Promise<ModuleOverview[]> {
    const userId = user.id;
    const countOf = (value: VoteValue) => sql<number>`(count(*) filter (where ${votes}.vote_value = ${value}))::int`;
    const rows = await db
      .select({
        id: modules.id,
        name: modules.name,
        semester: modules.semester,
        votingEndsAt: modules.votingEndsAt,
        gradeCount: sql<number>`(select count(*)::int from ${grades} where ${grades}.module_id = ${modules}.id)`,
        gradeAverage: sql<string | null>`(select avg(grade_tenths) from ${grades} where ${grades}.module_id = ${modules}.id)`,
        gradeBest: sql<number | null>`(select min(grade_tenths) from ${grades} where ${grades}.module_id = ${modules}.id)`,
        gradeWorst: sql<number | null>`(select max(grade_tenths) from ${grades} where ${grades}.module_id = ${modules}.id)`,
        myGradeTenths: sql<number | null>`(select grade_tenths from ${grades} where ${grades}.module_id = ${modules}.id and ${grades}.user_id = ${userId})`,
        free: countOf("free"),
        possible: countOf("possible"),
        impossible: countOf("impossible"),
        myVote: sql<VoteValue | null>`max(${votes}.vote_value::text) filter (where ${votes}.user_id = ${userId})`,
        // Raw sql`` bypasses Drizzle's date mapping, so the timestamp arrives as a string.
        myUpdatedAt: sql<string | null>`max(${votes}.updated_at) filter (where ${votes}.user_id = ${userId})`,
      })
      .from(modules)
      .leftJoin(votes, eq(votes.moduleId, modules.id))
      .where(moduleId ? and(eq(modules.courseId, courseId), eq(modules.id, moduleId)) : eq(modules.courseId, courseId))
      .groupBy(modules.id)
      .orderBy(asc(modules.semester), asc(modules.name));
    const time = now();
    return rows.map(
      ({ free, possible, impossible, myUpdatedAt, votingEndsAt, gradeCount, gradeAverage, gradeBest, gradeWorst, myGradeTenths, ...module }) => {
        const votingClosed = !!votingEndsAt && votingEndsAt <= time;
        // Others see grades only in aggregate and only once enough are in; a module still open shows none.
        const showStats = votingClosed && gradeCount >= MIN_GRADES_SHOWN;
        return {
      ...module,
      votingEndsAt: votingEndsAt?.toISOString() ?? null,
      votingClosed,
      myGrade: myGradeTenths === null ? null : myGradeTenths / 10,
      gradeStats: showStats
        ? { count: gradeCount, average: Math.round(Number(gradeAverage)) / 10, best: gradeBest! / 10, worst: gradeWorst! / 10 }
        : null,
      counts: { free, possible, impossible },
      canChangeAt: isExemptFromCooldown(user)
        ? null
        : (cooldownEnd(myUpdatedAt ? new Date(myUpdatedAt) : null, time)?.toISOString() ?? null),
        };
      },
    );
  }

  /**
   * Resolves the module a vote request targets, answering 404 if it is not in the user's course,
   * so users cannot vote on (or probe for) other courses' modules.
   */
  async function findVotableModule(response: Response, moduleId: string | undefined) {
    const user = response.locals.user as AuthUser;
    const course = await findUserCourse(user.id);
    if (!course || !isUuid(moduleId)) return null;
    const [module] = await loadOverview(course.id, user, moduleId);
    return module ? { user, course, module } : null;
  }

  /** Answers 429 with the time from which the vote can be changed again. */
  function sendCooldown(response: Response, retryAt: Date) {
    const seconds = Math.max(1, Math.ceil((retryAt.getTime() - now().getTime()) / 1000));
    const body: ApiError = { error: "vote_cooldown", retryAt: retryAt.toISOString() };
    response.status(429).set("Retry-After", String(seconds)).json(body);
  }

  /** Sends the refreshed module after a vote change and tells the rest of the course about it. */
  async function sendModule(response: Response, courseId: string, user: AuthUser, moduleId: string) {
    const [module] = await loadOverview(courseId, user, moduleId);
    events.publish(courseId, { type: "module-votes", moduleId, counts: module!.counts });
    const body: ModuleOverviewResponse = { module: module! };
    response.json(body);
  }

  // Live updates for the user's course. A user without a course has nothing to follow (204 stops
  // EventSource from reconnecting).
  router.get("/events", async (_request, response) => {
    const user = response.locals.user as AuthUser;
    const course = await findUserCourse(user.id);
    if (!course) return response.status(204).end();
    if (!events.subscribe(response, user.id, course.id)) return sendError(response, 429, "rate_limited");
  });

  router.get("/overview", async (_request, response) => {
    const user = response.locals.user as AuthUser;
    const course = await findUserCourse(user.id);
    const body: OverviewResponse = { course, modules: course ? await loadOverview(course.id, user) : [] };
    response.json(body);
  });

  router.get("/modules/:moduleId", async (request, response) => {
    const target = await findVotableModule(response, request.params.moduleId);
    if (!target) return sendError(response, 404, "not_found");
    const body: ModuleDetailResponse = {
      module: target.module,
      history: await loadVoteHistory(db, target.module.id, now()),
    };
    response.json(body);
  });

  router.put("/modules/:moduleId/vote", async (request, response) => {
    const value = readBody(request).value;
    if (!VOTE_VALUES.includes(value as VoteValue)) return sendError(response, 400, "invalid_request");
    const target = await findVotableModule(response, request.params.moduleId);
    if (!target) return sendError(response, 404, "not_found");
    if (target.module.votingClosed) return sendError(response, 409, "voting_closed");

    const result = await changeVote(db, {
      userId: target.user.id,
      moduleId: target.module.id,
      value: value as VoteValue,
      now: now(),
      ignoreCooldown: isExemptFromCooldown(target.user),
    });
    if (!result.ok) return sendCooldown(response, result.retryAt);
    await sendModule(response, target.course.id, target.user, target.module.id);
  });

  router.delete("/modules/:moduleId/vote", async (request, response) => {
    const target = await findVotableModule(response, request.params.moduleId);
    if (!target) return sendError(response, 404, "not_found");
    if (target.module.votingClosed) return sendError(response, 409, "voting_closed");

    const result = await changeVote(db, {
      userId: target.user.id,
      moduleId: target.module.id,
      value: null,
      now: now(),
      ignoreCooldown: isExemptFromCooldown(target.user),
    });
    if (!result.ok) return sendCooldown(response, result.retryAt);
    await sendModule(response, target.course.id, target.user, target.module.id);
  });

  /**
   * Reads a grade from 1.0 to 5.0 in steps of 0.1 and returns it in tenths, or null if it is anything else.
   * @param {unknown} value
   */
  function readGradeTenths(value: unknown): number | null {
    if (typeof value !== "number") return null;
    const tenths = Math.round(value * 10);
    const valid = Math.abs(value * 10 - tenths) < 1e-6 && tenths >= GRADE_MIN * 10 && tenths <= GRADE_MAX * 10;
    return valid ? tenths : null;
  }

  // Grades can only be entered once voting on the module has ended; until then the grade stays hidden.
  router.put("/modules/:moduleId/grade", async (request, response) => {
    const tenths = readGradeTenths(readBody(request).grade);
    if (tenths === null) return sendError(response, 400, "invalid_request");
    const target = await findVotableModule(response, request.params.moduleId);
    if (!target) return sendError(response, 404, "not_found");
    if (!target.module.votingClosed) return sendError(response, 409, "voting_open");

    await db
      .insert(grades)
      .values({ userId: target.user.id, moduleId: target.module.id, tenths, updatedAt: now() })
      .onConflictDoUpdate({ target: [grades.userId, grades.moduleId], set: { tenths, updatedAt: now() } });
    const [module] = await loadOverview(target.course.id, target.user, target.module.id);
    const body: ModuleOverviewResponse = { module: module! };
    response.json(body);
  });

  router.delete("/modules/:moduleId/grade", async (request, response) => {
    const target = await findVotableModule(response, request.params.moduleId);
    if (!target) return sendError(response, 404, "not_found");
    await db.delete(grades).where(and(eq(grades.userId, target.user.id), eq(grades.moduleId, target.module.id)));
    const [module] = await loadOverview(target.course.id, target.user, target.module.id);
    const body: ModuleOverviewResponse = { module: module! };
    response.json(body);
  });

  return router;
}
