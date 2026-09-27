import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../database";
import type { Mail } from "../mail";
import { TEST_SETUP_CODE, createTestApp, registerUser, resetDatabase } from "../testHelpers";

describe.skipIf(!process.env.DATABASE_URL)("voting routes (real Postgres)", () => {
  const database = createDatabase(process.env.DATABASE_URL ?? "");
  let sentMails: Mail[];
  let app: ReturnType<typeof createTestApp>;
  let adminCookie: string;
  let studentCookie: string;
  let courseId: string;

  beforeAll(() => database.runMigrations());
  afterAll(() => database.close());

  beforeEach(async () => {
    await resetDatabase(database.db);
    sentMails = [];
    app = createTestApp({ db: database.db, sentMails, now: () => new Date() });
    adminCookie = await registerUser(app, sentMails, { email: "admin@dhbw.example", adminSetupCode: TEST_SETUP_CODE });
    studentCookie = await registerUser(app, sentMails, { email: "student@dhbw.example" });
    const courses = await request(app).get("/api/admin/courses").set("Cookie", adminCookie);
    courseId = courses.body.courses[0].id;
  });

  /** Creates a module in the test course as admin and returns its id. */
  async function createModule(name: string, semester: number, inCourseId = courseId): Promise<string> {
    const response = await request(app)
      .post(`/api/admin/courses/${inCourseId}/modules`)
      .set("Cookie", adminCookie)
      .send({ name, semester })
      .expect(201);
    return response.body.module.id;
  }

  /** Casts a vote and returns the response. */
  function vote(cookie: string, moduleId: string, value: string) {
    return request(app).put(`/api/modules/${moduleId}/vote`).set("Cookie", cookie).send({ value });
  }

  it("requires a session", async () => {
    await request(app).get("/api/overview").expect(401);
  });

  it("lists the modules of the user's course by semester with empty counts", async () => {
    await createModule("Datenbanken", 3);
    await createModule("Mathematik I", 1);

    const response = await request(app).get("/api/overview").set("Cookie", studentCookie).expect(200);
    expect(response.body.course).toMatchObject({ id: courseId, name: "WWI 2024" });
    expect(response.body.modules).toEqual([
      expect.objectContaining({ name: "Mathematik I", semester: 1, counts: { free: 0, possible: 0, impossible: 0 }, myVote: null }),
      expect.objectContaining({ name: "Datenbanken", semester: 3, myVote: null }),
    ]);
  });

  it("counts votes of all users and shows each user only their own vote", async () => {
    const moduleId = await createModule("Datenbanken", 3);
    await vote(studentCookie, moduleId, "free").expect(200);
    await vote(adminCookie, moduleId, "impossible").expect(200);

    const student = await request(app).get("/api/overview").set("Cookie", studentCookie);
    expect(student.body.modules[0]).toMatchObject({ counts: { free: 1, possible: 0, impossible: 1 }, myVote: "free" });
    const admin = await request(app).get("/api/overview").set("Cookie", adminCookie);
    expect(admin.body.modules[0].myVote).toBe("impossible");
  });

  it("changes a vote instead of adding a second one", async () => {
    const moduleId = await createModule("Datenbanken", 3);
    await vote(studentCookie, moduleId, "free").expect(200);
    const response = await vote(studentCookie, moduleId, "possible").expect(200);

    expect(response.body.module).toMatchObject({ counts: { free: 0, possible: 1, impossible: 0 }, myVote: "possible" });
  });

  it("withdraws a vote", async () => {
    const moduleId = await createModule("Datenbanken", 3);
    await vote(studentCookie, moduleId, "free").expect(200);
    const response = await request(app)
      .delete(`/api/modules/${moduleId}/vote`)
      .set("Cookie", studentCookie)
      .expect(200);

    expect(response.body.module).toMatchObject({ counts: { free: 0, possible: 0, impossible: 0 }, myVote: null });
  });

  it("refuses an unknown vote value", async () => {
    const moduleId = await createModule("Datenbanken", 3);
    await vote(studentCookie, moduleId, "easy").expect(400);
  });

  it("answers 404 for a module of another course", async () => {
    const other = await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: "INF25A" });
    const foreignModuleId = await createModule("Fremd", 1, other.body.course.id);

    const response = await vote(studentCookie, foreignModuleId, "free");
    expect(response.status).toBe(404);
    await vote(studentCookie, "not-a-uuid", "free").expect(404);
  });

  it("shows no modules to a user without a course", async () => {
    const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
    const student = users.body.users.find((user: { email: string }) => user.email === "student@dhbw.example");
    await request(app).put(`/api/admin/users/${student.id}/course`).set("Cookie", adminCookie).send({ courseId: null });

    const response = await request(app).get("/api/overview").set("Cookie", studentCookie).expect(200);
    expect(response.body).toEqual({ course: null, modules: [] });
  });

  it("deletes the votes of a deleted module", async () => {
    const moduleId = await createModule("Datenbanken", 3);
    await vote(studentCookie, moduleId, "free").expect(200);
    await request(app).delete(`/api/admin/modules/${moduleId}`).set("Cookie", adminCookie).expect(204);

    const rows = await database.db.query.votes.findMany();
    expect(rows).toHaveLength(0);
  });
});
