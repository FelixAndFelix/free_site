import { Router, type Response } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  VOTE_VALUES,
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
import { courseMembers, courses, modules, votes } from "../schema";
import { loadVoteHistory } from "./history";
import { changeVote } from "./votes";

export interface VotingDependencies {
  db: Db;
  now?: () => Date;
}

/**
 * Builds the voting router: the overview of the user's course and casting, changing
 * or withdrawing the user's vote on a module. Logged-in users only.
 * @param {VotingDependencies} dependencies
 */
export function createVotingRouter({ db, now = () => new Date() }: VotingDependencies) {
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
  async function loadOverview(courseId: string, userId: string, moduleId?: string): Promise<ModuleOverview[]> {
    const countOf = (value: VoteValue) => sql<number>`(count(*) filter (where ${votes}.vote_value = ${value}))::int`;
    const rows = await db
      .select({
        id: modules.id,
        name: modules.name,
        semester: modules.semester,
        free: countOf("free"),
        possible: countOf("possible"),
        impossible: countOf("impossible"),
        myVote: sql<VoteValue | null>`max(${votes}.vote_value::text) filter (where ${votes}.user_id = ${userId})`,
      })
      .from(modules)
      .leftJoin(votes, eq(votes.moduleId, modules.id))
      .where(moduleId ? and(eq(modules.courseId, courseId), eq(modules.id, moduleId)) : eq(modules.courseId, courseId))
      .groupBy(modules.id)
      .orderBy(asc(modules.semester), asc(modules.name));
    return rows.map(({ free, possible, impossible, ...module }) => ({ ...module, counts: { free, possible, impossible } }));
  }

  /**
   * Resolves the module a vote request targets, answering 404 if it is not in the user's course,
   * so users cannot vote on (or probe for) other courses' modules.
   */
  async function findVotableModule(response: Response, moduleId: string | undefined) {
    const user = response.locals.user as AuthUser;
    const course = await findUserCourse(user.id);
    if (!course || !isUuid(moduleId)) return null;
    const [module] = await loadOverview(course.id, user.id, moduleId);
    return module ? { user, course, module } : null;
  }

  /** Sends the refreshed module after a vote change. */
  async function sendModule(response: Response, courseId: string, userId: string, moduleId: string) {
    const [module] = await loadOverview(courseId, userId, moduleId);
    const body: ModuleOverviewResponse = { module: module! };
    response.json(body);
  }

  router.get("/overview", async (_request, response) => {
    const user = response.locals.user as AuthUser;
    const course = await findUserCourse(user.id);
    const body: OverviewResponse = { course, modules: course ? await loadOverview(course.id, user.id) : [] };
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

    await changeVote(db, { userId: target.user.id, moduleId: target.module.id, value: value as VoteValue, now: now() });
    await sendModule(response, target.course.id, target.user.id, target.module.id);
  });

  router.delete("/modules/:moduleId/vote", async (request, response) => {
    const target = await findVotableModule(response, request.params.moduleId);
    if (!target) return sendError(response, 404, "not_found");

    await changeVote(db, { userId: target.user.id, moduleId: target.module.id, value: null, now: now() });
    await sendModule(response, target.course.id, target.user.id, target.module.id);
  });

  return router;
}
