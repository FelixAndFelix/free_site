import { Router, type Request, type Response } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  AUDIT_CATEGORIES,
  MAX_SEMESTER,
  NAME_MAX_LENGTH,
  USER_ROLES,
  type AdminCourse,
  type AdminUserEntry,
  type AuditAction,
  type AuditCategory,
  type AuthUser,
  type CourseResponse,
  type CoursesResponse,
  type Module,
  type ModuleResponse,
  type ModulesResponse,
  type UserEntryResponse,
  type UserRole,
  type UsersResponse,
} from "@free-site/shared";
import type { AuditLog } from "../audit/log";
import { requireRole } from "../auth/middleware";
import { generateJoinCode } from "../courses";
import { isUniqueViolation, type Db } from "../database";
import { isUuid, readBody, sendError } from "../http";
import { courseMembers, courses, modules, users } from "../schema";
import type { EventHub } from "../voting/events";
import { withdrawVotesOutsideCourse } from "../voting/votes";

export interface AdminDependencies {
  db: Db;
  events: EventHub;
  audit: AuditLog;
  now?: () => Date;
}

/**
 * Trims a name and returns it if it is 1 to NAME_MAX_LENGTH characters long, otherwise null.
 * @param {unknown} value
 */
function readName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 && name.length <= NAME_MAX_LENGTH ? name : null;
}

/**
 * Returns the value if it is a whole semester number from 1 to MAX_SEMESTER, otherwise null.
 * @param {unknown} value
 */
function readSemester(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_SEMESTER
    ? (value as number)
    : null;
}

/**
 * Builds the /api/admin router: courses, their modules and user roles. Admins only.
 * @param {AdminDependencies} dependencies
 */
export function createAdminRouter({ db, events, audit, now = () => new Date() }: AdminDependencies) {
  const router = Router();
  router.use(requireRole({ db, role: "admin", now }));

  // Drizzle renders columns unqualified inside sql``, where "id" would bind to the subquery's own
  // table, so the correlation is written with explicit table names.
  const courseColumns = {
    id: courses.id,
    name: courses.name,
    joinCode: courses.joinCode,
    memberCount: sql<number>`(select count(*)::int from ${courseMembers} where ${courseMembers}.course_id = ${courses}.id)`,
    moduleCount: sql<number>`(select count(*)::int from ${modules} where ${modules}.course_id = ${courses}.id)`,
  };
  const userColumns = {
    id: users.id,
    email: users.email,
    username: users.username,
    role: users.role,
    courseId: courses.id,
    courseName: courses.name,
  };

  /** Records an admin change in the audit log, with the admin who made it. */
  function recordAudit(
    request: Request,
    response: Response,
    action: AuditAction,
    extras: { targetUserId?: string; email?: string | null; label?: string | null } = {},
  ) {
    return audit.record({
      category: "audit",
      action,
      actorUserId: (response.locals.user as AuthUser).id,
      ip: request.ip,
      ...extras,
    });
  }

  /** Loads one course with its counts, or undefined. */
  async function findCourse(courseId: string): Promise<AdminCourse | undefined> {
    const [course] = await db.select(courseColumns).from(courses).where(eq(courses.id, courseId));
    return course;
  }

  /** Loads one user with the name of their course, or undefined. */
  async function findUserEntry(userId: string): Promise<AdminUserEntry | undefined> {
    const [user] = await db
      .select(userColumns)
      .from(users)
      .leftJoin(courseMembers, eq(courseMembers.userId, users.id))
      .leftJoin(courses, eq(courses.id, courseMembers.courseId))
      .where(eq(users.id, userId));
    return user;
  }

  /** Sends one course, or 404 if it does not exist. */
  async function sendCourse(response: Response, status: number, courseId: string) {
    const course = await findCourse(courseId);
    if (!course) return sendError(response, 404, "not_found");
    const body: CourseResponse = { course };
    response.status(status).json(body);
  }

  router.get("/courses", async (_request, response) => {
    const body: CoursesResponse = { courses: await db.select(courseColumns).from(courses).orderBy(asc(courses.name)) };
    response.json(body);
  });

  router.post("/courses", async (request, response) => {
    const name = readName(readBody(request).name);
    if (!name) return sendError(response, 400, "invalid_request");
    try {
      const [created] = await db.insert(courses).values({ name, joinCode: generateJoinCode(name) }).returning();
      await recordAudit(request, response, "course.created", { label: name });
      await sendCourse(response, 201, created!.id);
    } catch (error) {
      if (isUniqueViolation(error)) return sendError(response, 409, "course_exists");
      throw error;
    }
  });

  // Rotating replaces a leaked code; registered members stay in the course.
  router.post("/courses/:courseId/join-code", async (request, response) => {
    const { courseId } = request.params;
    if (!isUuid(courseId)) return sendError(response, 404, "not_found");
    const [course] = await db.select({ name: courses.name }).from(courses).where(eq(courses.id, courseId));
    if (!course) return sendError(response, 404, "not_found");
    await db.update(courses).set({ joinCode: generateJoinCode(course.name) }).where(eq(courses.id, courseId));
    await recordAudit(request, response, "course.join_code_rotated", { label: course.name });
    await sendCourse(response, 200, courseId);
  });

  // The join code keeps its old prefix on purpose: renaming must not break links already shared.
  router.patch("/courses/:courseId", async (request, response) => {
    const { courseId } = request.params;
    const name = readName(readBody(request).name);
    if (!isUuid(courseId)) return sendError(response, 404, "not_found");
    if (!name) return sendError(response, 400, "invalid_request");
    const before = await findCourse(courseId);
    try {
      const updated = await db.update(courses).set({ name }).where(eq(courses.id, courseId)).returning({ id: courses.id });
      if (updated.length === 0) return sendError(response, 404, "not_found");
    } catch (error) {
      if (isUniqueViolation(error)) return sendError(response, 409, "course_exists");
      throw error;
    }
    await recordAudit(request, response, "course.renamed", { label: `${before?.name ?? "?"} → ${name}` });
    // Members see the course name in the overview.
    events.publish(courseId, { type: "modules-changed" });
    await sendCourse(response, 200, courseId);
  });

  // Only empty courses can be deleted, so no account is removed by accident; modules go with the course.
  router.delete("/courses/:courseId", async (request, response) => {
    const { courseId } = request.params;
    if (!isUuid(courseId)) return sendError(response, 404, "not_found");
    const existing = await findCourse(courseId);
    const hasNoMembers = sql`not exists (select 1 from ${courseMembers} where ${courseMembers}.course_id = ${courses}.id)`;
    const deleted = await db
      .delete(courses)
      .where(and(eq(courses.id, courseId), hasNoMembers))
      .returning({ id: courses.id });
    if (deleted.length === 1) {
      await recordAudit(request, response, "course.deleted", { label: existing?.name });
      return response.status(204).end();
    }
    const course = await findCourse(courseId);
    return course ? sendError(response, 409, "course_not_empty") : sendError(response, 404, "not_found");
  });

  router.get("/courses/:courseId/modules", async (request, response) => {
    const { courseId } = request.params;
    if (!isUuid(courseId) || !(await findCourse(courseId))) return sendError(response, 404, "not_found");
    const rows: Module[] = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, courseId))
      .orderBy(asc(modules.semester), asc(modules.name));
    const body: ModulesResponse = { modules: rows };
    response.json(body);
  });

  router.post("/courses/:courseId/modules", async (request, response) => {
    const { courseId } = request.params;
    const course = isUuid(courseId) ? await findCourse(courseId) : undefined;
    if (!course) return sendError(response, 404, "not_found");
    const fields = readBody(request);
    const name = readName(fields.name);
    const semester = readSemester(fields.semester);
    if (!name || semester === null) return sendError(response, 400, "invalid_request");

    const [created] = await db.insert(modules).values({ courseId, name, semester }).returning();
    await recordAudit(request, response, "module.created", { label: `${name} (${course.name})` });
    events.publish(courseId, { type: "modules-changed" });
    const body: ModuleResponse = { module: created! };
    response.status(201).json(body);
  });

  // Renames a module and/or moves it to another semester; its votes and history stay with it.
  router.patch("/modules/:moduleId", async (request, response) => {
    const { moduleId } = request.params;
    if (!isUuid(moduleId)) return sendError(response, 404, "not_found");
    const fields = readBody(request);
    const changes: { name?: string; semester?: number } = {};
    if ("name" in fields) {
      const name = readName(fields.name);
      if (!name) return sendError(response, 400, "invalid_request");
      changes.name = name;
    }
    if ("semester" in fields) {
      const semester = readSemester(fields.semester);
      if (semester === null) return sendError(response, 400, "invalid_request");
      changes.semester = semester;
    }
    if (Object.keys(changes).length === 0) return sendError(response, 400, "invalid_request");

    const [updated] = await db.update(modules).set(changes).where(eq(modules.id, moduleId)).returning();
    if (!updated) return sendError(response, 404, "not_found");
    await recordAudit(request, response, "module.updated", { label: updated.name });
    events.publish(updated.courseId, { type: "modules-changed" });
    const body: ModuleResponse = { module: updated };
    response.json(body);
  });

  router.delete("/modules/:moduleId", async (request, response) => {
    const { moduleId } = request.params;
    if (!isUuid(moduleId)) return sendError(response, 404, "not_found");
    const deleted = await db.delete(modules).where(eq(modules.id, moduleId)).returning();
    if (deleted.length === 0) return sendError(response, 404, "not_found");
    await recordAudit(request, response, "module.deleted", { label: deleted[0]!.name });
    events.publish(deleted[0]!.courseId, { type: "modules-changed" });
    response.status(204).end();
  });

  router.get("/users", async (_request, response) => {
    const rows = await db
      .select(userColumns)
      .from(users)
      .leftJoin(courseMembers, eq(courseMembers.userId, users.id))
      .leftJoin(courses, eq(courses.id, courseMembers.courseId))
      .orderBy(asc(users.email));
    const body: UsersResponse = { users: rows };
    response.json(body);
  });

  // A user belongs to at most one course (MVP), so setting a course replaces the old membership.
  router.put("/users/:userId/course", async (request, response) => {
    const { userId } = request.params;
    const courseId = readBody(request).courseId;
    if (courseId !== null && typeof courseId !== "string") return sendError(response, 400, "invalid_request");
    const before = isUuid(userId) ? await findUserEntry(userId) : undefined;
    if (!before) return sendError(response, 404, "not_found");
    const newCourse = typeof courseId === "string" && isUuid(courseId) ? await findCourse(courseId) : undefined;
    if (courseId !== null && !newCourse) return sendError(response, 404, "not_found");

    await db.transaction(async (transaction) => {
      await transaction.delete(courseMembers).where(eq(courseMembers.userId, userId));
      if (courseId !== null) await transaction.insert(courseMembers).values({ courseId, userId });
    });
    // Votes only count in the voter's course, so votes on the old course's modules are withdrawn.
    await withdrawVotesOutsideCourse(db, { userId, courseId, now: now() });
    await recordAudit(request, response, "user.course_changed", {
      targetUserId: userId,
      email: before.email,
      label: newCourse?.name ?? null,
    });
    // The old course's counts changed; the user's own streams reconnect and follow the new course.
    events.userLeftCourse(userId, before.courseId !== courseId ? before.courseId : null);
    const body: UserEntryResponse = { user: (await findUserEntry(userId))! };
    response.json(body);
  });

  router.patch("/users/:userId", async (request, response) => {
    const { userId } = request.params;
    const currentUser = response.locals.user as AuthUser;
    const role = readBody(request).role;
    if (!USER_ROLES.includes(role as UserRole)) return sendError(response, 400, "invalid_request");
    if (!isUuid(userId)) return sendError(response, 404, "not_found");
    // Admins cannot demote themselves, so there is always at least one admin left.
    if (userId === currentUser.id) return sendError(response, 400, "cannot_change_own_role");

    const updated = await db
      .update(users)
      .set({ role: role as UserRole })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (updated.length === 0) return sendError(response, 404, "not_found");
    const entry = (await findUserEntry(userId))!;
    await recordAudit(request, response, "user.role_changed", { targetUserId: userId, email: entry.email, label: role as string });
    const body: UserEntryResponse = { user: entry };
    response.json(body);
  });

  // The activity log, one category at a time (admin changes, or sign-ins and accounts).
  router.get("/audit", async (request, response) => {
    const { category, cursor } = request.query;
    if (!AUDIT_CATEGORIES.includes(category as AuditCategory)) return sendError(response, 400, "invalid_request");
    if (cursor !== undefined && typeof cursor !== "string") return sendError(response, 400, "invalid_request");
    const page = await audit.list({ category: category as AuditCategory, cursor });
    if (!page) return sendError(response, 400, "invalid_request");
    response.json(page);
  });

  return router;
}
