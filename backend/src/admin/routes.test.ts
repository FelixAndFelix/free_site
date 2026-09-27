import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../database";
import type { Mail } from "../mail";
import { TEST_SETUP_CODE, createTestApp, registerUser, resetDatabase } from "../testHelpers";

describe.skipIf(!process.env.DATABASE_URL)("admin routes (real Postgres)", () => {
  const database = createDatabase(process.env.DATABASE_URL ?? "");
  let sentMails: Mail[];
  let app: ReturnType<typeof createTestApp>;
  let adminCookie: string;

  beforeAll(() => database.runMigrations());
  afterAll(() => database.close());

  beforeEach(async () => {
    await resetDatabase(database.db);
    sentMails = [];
    app = createTestApp({ db: database.db, sentMails, now: () => new Date() });
    adminCookie = await registerUser(app, sentMails, { email: "admin@dhbw.example", adminSetupCode: TEST_SETUP_CODE });
  });

  /** Creates a course as admin and returns it. */
  async function createCourse(name: string) {
    const response = await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name }).expect(201);
    return response.body.course;
  }

  describe("access", () => {
    it("rejects visitors without a session", async () => {
      await request(app).get("/api/admin/courses").expect(401);
    });

    it("rejects logged-in users who are not admins", async () => {
      const userCookie = await registerUser(app, sentMails, { email: "user@dhbw.example" });
      const response = await request(app).get("/api/admin/courses").set("Cookie", userCookie);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "forbidden" });
    });
  });

  describe("courses", () => {
    it("creates a course with a generated join code others can register with", async () => {
      const course = await createCourse("INF24B");

      expect(course).toMatchObject({ name: "INF24B", memberCount: 0, moduleCount: 0 });
      expect(course.joinCode).toMatch(/^INF24B-[A-Z2-9]{8}$/);
      await request(app)
        .post("/api/auth/register/start")
        .send({ email: "new@dhbw.example", username: "student", courseCode: course.joinCode })
        .expect(202);
    });

    it("lists courses with member counts", async () => {
      await createCourse("INF24B");
      const response = await request(app).get("/api/admin/courses").set("Cookie", adminCookie).expect(200);

      expect(response.body.courses.map((course: { name: string }) => course.name)).toEqual(["INF24B", "WWI 2024"]);
      expect(response.body.courses[1].memberCount).toBe(1);
    });

    it("refuses a duplicate course name", async () => {
      await createCourse("INF24B");
      const response = await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: " INF24B " });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "course_exists" });
    });

    it("refuses an empty name", async () => {
      await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: "  " }).expect(400);
    });

    it("rotates the join code so the old one stops working", async () => {
      const course = await createCourse("INF24B");
      const response = await request(app)
        .post(`/api/admin/courses/${course.id}/join-code`)
        .set("Cookie", adminCookie)
        .expect(200);

      expect(response.body.course.joinCode).not.toBe(course.joinCode);
      const oldCode = await request(app)
        .post("/api/auth/register/start")
        .send({ email: "new@dhbw.example", username: "student", courseCode: course.joinCode });
      expect(oldCode.body).toEqual({ error: "invalid_course_code" });
    });

    it("answers 404 for an unknown or malformed course id", async () => {
      await request(app)
        .post("/api/admin/courses/00000000-0000-0000-0000-000000000000/join-code")
        .set("Cookie", adminCookie)
        .expect(404);
      await request(app).get("/api/admin/courses/not-a-uuid/modules").set("Cookie", adminCookie).expect(404);
    });
  });

  describe("modules", () => {
    it("creates modules and lists them by semester, then name", async () => {
      const course = await createCourse("INF24B");
      const path = `/api/admin/courses/${course.id}/modules`;
      await request(app).post(path).set("Cookie", adminCookie).send({ name: "Datenbanken", semester: 3 }).expect(201);
      await request(app).post(path).set("Cookie", adminCookie).send({ name: "Mathematik I", semester: 1 }).expect(201);
      await request(app).post(path).set("Cookie", adminCookie).send({ name: "Analysis", semester: 3 }).expect(201);

      const response = await request(app).get(path).set("Cookie", adminCookie).expect(200);
      expect(response.body.modules.map((module: { name: string }) => module.name)).toEqual([
        "Mathematik I",
        "Analysis",
        "Datenbanken",
      ]);
      const listed = await request(app).get("/api/admin/courses").set("Cookie", adminCookie);
      expect(listed.body.courses[0]).toMatchObject({ name: "INF24B", moduleCount: 3 });
    });

    it("refuses a semester outside 1 to 6", async () => {
      const course = await createCourse("INF24B");
      const path = `/api/admin/courses/${course.id}/modules`;

      await request(app).post(path).set("Cookie", adminCookie).send({ name: "Too late", semester: 7 }).expect(400);
      await request(app).post(path).set("Cookie", adminCookie).send({ name: "Not a number", semester: "2" }).expect(400);
    });

    it("deletes a module", async () => {
      const course = await createCourse("INF24B");
      const created = await request(app)
        .post(`/api/admin/courses/${course.id}/modules`)
        .set("Cookie", adminCookie)
        .send({ name: "Datenbanken", semester: 3 });

      await request(app).delete(`/api/admin/modules/${created.body.module.id}`).set("Cookie", adminCookie).expect(204);
      await request(app).delete(`/api/admin/modules/${created.body.module.id}`).set("Cookie", adminCookie).expect(404);
    });
  });

  describe("users", () => {
    it("lists users with their course", async () => {
      const response = await request(app).get("/api/admin/users").set("Cookie", adminCookie).expect(200);

      expect(response.body.users).toEqual([
        expect.objectContaining({ email: "admin@dhbw.example", role: "admin", courseName: "WWI 2024" }),
      ]);
    });

    it("promotes a user to admin", async () => {
      const userCookie = await registerUser(app, sentMails, { email: "user@dhbw.example" });
      const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
      const user = users.body.users.find((entry: { email: string }) => entry.email === "user@dhbw.example");

      const response = await request(app)
        .patch(`/api/admin/users/${user.id}`)
        .set("Cookie", adminCookie)
        .send({ role: "admin" })
        .expect(200);
      expect(response.body.user.role).toBe("admin");
      await request(app).get("/api/admin/courses").set("Cookie", userCookie).expect(200);
    });

    it("does not let an admin change their own role", async () => {
      const me = await request(app).get("/api/auth/me").set("Cookie", adminCookie);
      const response = await request(app)
        .patch(`/api/admin/users/${me.body.user.id}`)
        .set("Cookie", adminCookie)
        .send({ role: "user" });

      expect(response.body).toEqual({ error: "cannot_change_own_role" });
    });

    it("refuses an unknown role", async () => {
      const me = await request(app).get("/api/auth/me").set("Cookie", adminCookie);
      await request(app)
        .patch(`/api/admin/users/${me.body.user.id}`)
        .set("Cookie", adminCookie)
        .send({ role: "superuser" })
        .expect(400);
    });
  });
});
