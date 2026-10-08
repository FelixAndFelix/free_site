import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../database";
import type { Mail } from "../mail";
import { courseMembers } from "../schema";
import { TEST_COURSE_CODE, TEST_SETUP_CODE, createTestApp, registerUser, resetDatabase } from "../testHelpers";

describe.skipIf(!process.env.DATABASE_URL)("invite links (real Postgres)", () => {
  const database = createDatabase(process.env.DATABASE_URL ?? "");
  let sentMails: Mail[];
  let time: number;
  let app: ReturnType<typeof createTestApp>;
  let adminCookie: string;
  let studentCookie: string;
  let otherCourseCode: string;
  let otherCourseId: string;
  let moduleId: string;

  beforeAll(() => database.runMigrations());
  afterAll(() => database.close());

  beforeEach(async () => {
    await resetDatabase(database.db);
    sentMails = [];
    time = Date.parse("2026-10-01T10:00:00Z");
    app = createTestApp({ db: database.db, sentMails, now: () => new Date(time) });
    adminCookie = await registerUser(app, sentMails, { email: "admin@dhbw.example", adminSetupCode: TEST_SETUP_CODE });
    studentCookie = await registerUser(app, sentMails, { email: "student@dhbw.example" });

    const courses = await request(app).get("/api/admin/courses").set("Cookie", adminCookie);
    const first = courses.body.courses[0];
    const created = await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: "INF25A" });
    otherCourseCode = created.body.course.joinCode;
    otherCourseId = created.body.course.id;
    const module = await request(app)
      .post(`/api/admin/courses/${first.id}/modules`)
      .set("Cookie", adminCookie)
      .send({ name: "Datenbanken", semester: 3 });
    moduleId = module.body.module.id;
  });

  /** Moves the student out of every course, as an admin would. */
  async function removeStudentFromCourse() {
    const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
    const student = users.body.users.find((user: { email: string }) => user.email === "student@dhbw.example");
    await request(app).put(`/api/admin/users/${student.id}/course`).set("Cookie", adminCookie).send({ courseId: null });
  }

  describe("looking up an invite link", () => {
    it("shows only the course name to guests", async () => {
      const response = await request(app).get(`/api/join/${TEST_COURSE_CODE}`).expect(200);

      expect(response.body).toEqual({ course: { name: "WWI 2024" } });
    });

    it("tells a logged-in user how they relate to the course", async () => {
      const same = await request(app).get(`/api/join/${TEST_COURSE_CODE}`).set("Cookie", studentCookie);
      expect(same.body).toEqual({ course: { name: "WWI 2024" }, membership: "same" });

      const other = await request(app).get(`/api/join/${otherCourseCode}`).set("Cookie", studentCookie);
      expect(other.body).toEqual({ course: { name: "INF25A" }, membership: "other", currentCourseName: "WWI 2024" });

      await removeStudentFromCourse();
      const none = await request(app).get(`/api/join/${otherCourseCode}`).set("Cookie", studentCookie);
      expect(none.body).toEqual({ course: { name: "INF25A" }, membership: "none" });
    });

    it("answers 404 for an unknown code", async () => {
      const response = await request(app).get("/api/join/NOPE-12345678");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    });

    it("limits guessing: 20 unknown codes per IP, while valid links never count", async () => {
      for (let attempt = 0; attempt < 30; attempt++) await request(app).get(`/api/join/${TEST_COURSE_CODE}`).expect(200);
      for (let attempt = 0; attempt < 20; attempt++) await request(app).get(`/api/join/WRONG-${attempt}`).expect(404);

      await request(app).get("/api/join/WRONG-NEXT").expect(429);
      await request(app).get(`/api/join/${TEST_COURSE_CODE}`).expect(429);

      time += 16 * 60_000;
      await request(app).get(`/api/join/${TEST_COURSE_CODE}`).expect(200);
    });
  });

  describe("joining", () => {
    it("requires a session", async () => {
      await request(app).post(`/api/join/${otherCourseCode}`).send({}).expect(401);
    });

    it("puts a user without a course into the course", async () => {
      await removeStudentFromCourse();

      const response = await request(app).post(`/api/join/${otherCourseCode}`).set("Cookie", studentCookie).send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ course: { id: otherCourseId, name: "INF25A" } });
      const overview = await request(app).get("/api/overview").set("Cookie", studentCookie);
      expect(overview.body.course.name).toBe("INF25A");
    });

    it("does nothing for a user who is already a member", async () => {
      const response = await request(app).post(`/api/join/${TEST_COURSE_CODE}`).set("Cookie", studentCookie).send({});

      expect(response.status).toBe(200);
      expect(await database.db.$count(courseMembers)).toBe(2);
    });

    it("asks for confirmation before leaving another course", async () => {
      const response = await request(app).post(`/api/join/${otherCourseCode}`).set("Cookie", studentCookie).send({});

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "already_in_course" });
      const overview = await request(app).get("/api/overview").set("Cookie", studentCookie);
      expect(overview.body.course.name).toBe("WWI 2024");
    });

    it("switches courses after confirmation and withdraws the votes of the old course", async () => {
      await request(app).put(`/api/modules/${moduleId}/vote`).set("Cookie", studentCookie).send({ value: "free" }).expect(200);

      const response = await request(app)
        .post(`/api/join/${otherCourseCode}`)
        .set("Cookie", studentCookie)
        .send({ confirmSwitch: true });

      expect(response.status).toBe(200);
      const overview = await request(app).get("/api/overview").set("Cookie", studentCookie);
      expect(overview.body.course.name).toBe("INF25A");
      const oldCourse = await request(app).get(`/api/modules/${moduleId}`).set("Cookie", adminCookie);
      expect(oldCourse.body.module.counts).toEqual({ free: 0, possible: 0, impossible: 0 });
      const memberships = await database.db.query.courseMembers.findMany();
      expect(memberships.filter(({ courseId }) => courseId === otherCourseId)).toHaveLength(1);
    });

    it("never leaves a user in two courses when joins race", async () => {
      await Promise.all([
        request(app).post(`/api/join/${otherCourseCode}`).set("Cookie", studentCookie).send({ confirmSwitch: true }),
        request(app).post(`/api/join/${TEST_COURSE_CODE}`).set("Cookie", studentCookie).send({ confirmSwitch: true }),
        request(app).post(`/api/join/${otherCourseCode}`).set("Cookie", studentCookie).send({ confirmSwitch: true }),
      ]);

      const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
      expect(users.body.users.filter((user: { email: string }) => user.email === "student@dhbw.example")).toHaveLength(1);
    });

    it("answers 404 for an unknown code", async () => {
      await request(app).post("/api/join/NOPE-12345678").set("Cookie", studentCookie).send({}).expect(404);
    });
  });
});
