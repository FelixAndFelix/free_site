import { Router, type Response } from "express";
import { asc, eq, sql } from "drizzle-orm";
import {
  MAX_SEMESTER,
  NAME_MAX_LENGTH,
  USER_ROLES,
  type AdminCourse,
  type AdminUserEntry,
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
import { requireRole } from "../auth/middleware";
import { generateJoinCode } from "../courses";
import { isUniqueViolation, type Db } from "../database";
import { isUuid, readBody, sendError } from "../http";
import { courseMembers, courses, modules, users } from "../schema";

export interface AdminDependencies {
  db: Db;
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
 * Builds the /api/admin router: courses, their modules and user roles. Admins only.
 * @param {AdminDependencies} dependencies
 */
export function createAdminRouter({ db, now = () => new Date() }: AdminDependencies) {
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
    courseName: courses.name,
  };

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
    await sendCourse(response, 200, courseId);
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
    if (!isUuid(courseId) || !(await findCourse(courseId))) return sendError(response, 404, "not_found");
    const fields = readBody(request);
    const name = readName(fields.name);
    const semester = fields.semester;
    const isValidSemester = Number.isInteger(semester) && (semester as number) >= 1 && (semester as number) <= MAX_SEMESTER;
    if (!name || !isValidSemester) return sendError(response, 400, "invalid_request");

    const [created] = await db.insert(modules).values({ courseId, name, semester: semester as number }).returning();
    const body: ModuleResponse = { module: created! };
    response.status(201).json(body);
  });

  router.delete("/modules/:moduleId", async (request, response) => {
    const { moduleId } = request.params;
    if (!isUuid(moduleId)) return sendError(response, 404, "not_found");
    const deleted = await db.delete(modules).where(eq(modules.id, moduleId)).returning();
    if (deleted.length === 0) return sendError(response, 404, "not_found");
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
    const body: UserEntryResponse = { user: (await findUserEntry(userId))! };
    response.json(body);
  });

  return router;
}
