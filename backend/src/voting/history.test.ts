import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../database";
import type { Mail } from "../mail";
import { TEST_SETUP_CODE, createTestApp, registerUser, resetDatabase } from "../testHelpers";
import { toBerlinDay } from "./history";

describe("toBerlinDay", () => {
  it("cuts days at midnight in Germany, not UTC", () => {
    expect(toBerlinDay(new Date("2026-10-01T21:59:00Z"))).toBe("2026-10-01");
    expect(toBerlinDay(new Date("2026-10-01T22:01:00Z"))).toBe("2026-10-02");
  });
});

describe.skipIf(!process.env.DATABASE_URL)("vote history (real Postgres)", () => {
  const database = createDatabase(process.env.DATABASE_URL ?? "");
  let sentMails: Mail[];
  let time: number;
  let app: ReturnType<typeof createTestApp>;
  let adminCookie: string;
  let studentCookie: string;
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
    const created = await request(app)
      .post(`/api/admin/courses/${courses.body.courses[0].id}/modules`)
      .set("Cookie", adminCookie)
      .send({ name: "Datenbanken", semester: 3 });
    moduleId = created.body.module.id;
  });

  /** Casts a vote at the current test time. */
  function vote(cookie: string, value: string) {
    return request(app).put(`/api/modules/${moduleId}/vote`).set("Cookie", cookie).send({ value }).expect(200);
  }

  /** Loads the module detail with its history. */
  async function history() {
    const response = await request(app).get(`/api/modules/${moduleId}`).set("Cookie", studentCookie).expect(200);
    return response.body.history;
  }

  it("has no history before the first vote", async () => {
    expect(await history()).toEqual([]);
  });

  it("records the counts at the end of every day and fills days without changes", async () => {
    await vote(studentCookie, "free");
    await vote(adminCookie, "free");
    time += 2 * 24 * 60 * 60 * 1000;
    await vote(studentCookie, "impossible");
    time += 24 * 60 * 60 * 1000;

    expect(await history()).toEqual([
      { day: "2026-10-01", counts: { free: 2, possible: 0, impossible: 0 } },
      { day: "2026-10-02", counts: { free: 2, possible: 0, impossible: 0 } },
      { day: "2026-10-03", counts: { free: 1, possible: 0, impossible: 1 } },
      { day: "2026-10-04", counts: { free: 1, possible: 0, impossible: 1 } },
    ]);
  });

  it("keeps only the last state of a day when someone changes their mind", async () => {
    await vote(studentCookie, "free");
    time += 60_000;
    await vote(studentCookie, "possible");

    expect(await history()).toEqual([{ day: "2026-10-01", counts: { free: 0, possible: 1, impossible: 0 } }]);
  });

  it("records a withdrawn vote and ignores a repeated identical vote", async () => {
    await vote(studentCookie, "free");
    await vote(studentCookie, "free");
    time += 24 * 60 * 60 * 1000;
    await request(app).delete(`/api/modules/${moduleId}/vote`).set("Cookie", studentCookie).expect(200);

    expect(await history()).toEqual([
      { day: "2026-10-01", counts: { free: 1, possible: 0, impossible: 0 } },
      { day: "2026-10-02", counts: { free: 0, possible: 0, impossible: 0 } },
    ]);
    const rows = await database.db.query.voteChanges.findMany();
    expect(rows).toHaveLength(2);
  });

  it("stores no user in the history", async () => {
    await vote(studentCookie, "free");

    const [row] = await database.db.query.voteChanges.findMany();
    expect(Object.keys(row!).sort()).toEqual(["changedAt", "fromValue", "id", "moduleId", "toValue"]);
  });

  it("ends on the same counts as the current votes", async () => {
    await vote(studentCookie, "possible");
    await vote(adminCookie, "impossible");
    time += 5 * 60 * 60 * 1000;
    await vote(adminCookie, "free");

    const response = await request(app).get(`/api/modules/${moduleId}`).set("Cookie", studentCookie);
    expect(response.body.history.at(-1).counts).toEqual(response.body.module.counts);
  });

  it("withdraws and records the votes of a user moved to another course", async () => {
    await vote(studentCookie, "free");
    const other = await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: "INF25A" });
    const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
    const student = users.body.users.find((user: { email: string }) => user.email === "student@dhbw.example");
    time += 24 * 60 * 60 * 1000;
    await request(app)
      .put(`/api/admin/users/${student.id}/course`)
      .set("Cookie", adminCookie)
      .send({ courseId: other.body.course.id })
      .expect(200);

    const response = await request(app).get(`/api/modules/${moduleId}`).set("Cookie", adminCookie).expect(200);
    expect(response.body.module.counts).toEqual({ free: 0, possible: 0, impossible: 0 });
    expect(response.body.history.at(-1)).toEqual({ day: "2026-10-02", counts: { free: 0, possible: 0, impossible: 0 } });
  });

  it("answers 404 for a module of another course", async () => {
    const other = await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: "INF25A" });
    const foreign = await request(app)
      .post(`/api/admin/courses/${other.body.course.id}/modules`)
      .set("Cookie", adminCookie)
      .send({ name: "Fremd", semester: 1 });
    await request(app).get(`/api/modules/${foreign.body.module.id}`).set("Cookie", studentCookie).expect(404);
  });
});
