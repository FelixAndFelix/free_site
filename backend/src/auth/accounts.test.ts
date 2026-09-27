import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../database";
import type { Mail } from "../mail";
import { emailCodes, sessions } from "../schema";
import { TEST_PASSWORD, TEST_SETUP_CODE, createTestApp, registerUser, resetDatabase } from "../testHelpers";
import { deleteExpiredRecords } from "./accounts";

describe.skipIf(!process.env.DATABASE_URL)("accounts (real Postgres)", () => {
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

  /** Deletes the account behind a session with the given password. */
  function deleteAccount(cookie: string, password = TEST_PASSWORD) {
    return request(app).delete("/api/auth/account").set("Cookie", cookie).send({ password });
  }

  describe("deleting an account", () => {
    it("deletes the account, logs out and frees the email and username", async () => {
      const response = await deleteAccount(studentCookie).expect(204);

      expect(response.headers["set-cookie"]?.[0]).toMatch(/^session=;/);
      await request(app).get("/api/auth/me").set("Cookie", studentCookie).expect(401);
      await request(app)
        .post("/api/auth/login")
        .send({ email: "student@dhbw.example", password: TEST_PASSWORD })
        .expect(401);
      await registerUser(app, sentMails, { email: "student@dhbw.example" });
    });

    it("removes the user's votes from the totals and records it in the history", async () => {
      await request(app).put(`/api/modules/${moduleId}/vote`).set("Cookie", studentCookie).send({ value: "free" });
      await request(app).put(`/api/modules/${moduleId}/vote`).set("Cookie", adminCookie).send({ value: "possible" });

      // Within the student's vote cooldown: deleting the account is not blocked by it.
      time += 60_000;
      await deleteAccount(studentCookie).expect(204);

      const detail = await request(app).get(`/api/modules/${moduleId}`).set("Cookie", adminCookie);
      expect(detail.body.module.counts).toEqual({ free: 0, possible: 1, impossible: 0 });
      expect(detail.body.history.at(-1).counts).toEqual(detail.body.module.counts);
      const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
      expect(users.body.users.map((user: { email: string }) => user.email)).toEqual(["admin@dhbw.example"]);
    });

    it("keeps the anonymous history", async () => {
      await request(app).put(`/api/modules/${moduleId}/vote`).set("Cookie", studentCookie).send({ value: "free" });
      await deleteAccount(studentCookie).expect(204);

      const changes = await database.db.query.voteChanges.findMany();
      expect(changes.map(({ fromValue, toValue }) => [fromValue, toValue])).toEqual([
        [null, "free"],
        ["free", null],
      ]);
    });

    it("requires the right password and counts wrong ones like failed logins", async () => {
      const wrong = await deleteAccount(studentCookie, "not my password");
      expect(wrong.status).toBe(401);
      expect(wrong.body).toEqual({ error: "invalid_credentials" });
      await request(app).get("/api/auth/me").set("Cookie", studentCookie).expect(200);

      for (let attempt = 0; attempt < 4; attempt++) await deleteAccount(studentCookie, "not my password").expect(401);
      await deleteAccount(studentCookie).expect(429);
    });

    it("requires a session", async () => {
      await request(app).delete("/api/auth/account").send({ password: TEST_PASSWORD }).expect(401);
    });

    it("refuses to delete the last admin", async () => {
      const response = await deleteAccount(adminCookie);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "last_admin" });
    });

    it("lets an admin leave once another admin exists", async () => {
      const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
      const student = users.body.users.find((user: { email: string }) => user.email === "student@dhbw.example");
      await request(app).patch(`/api/admin/users/${student.id}`).set("Cookie", adminCookie).send({ role: "admin" });

      await deleteAccount(adminCookie).expect(204);
    });
  });

  describe("cleanup of expired records", () => {
    it("deletes expired email codes and sessions, and keeps valid ones", async () => {
      await request(app).post("/api/auth/reset/start").send({ email: "student@dhbw.example" }).expect(202);
      const before = { codes: await database.db.$count(emailCodes), sessions: await database.db.$count(sessions) };
      expect(before).toEqual({ codes: 1, sessions: 2 });

      expect(await deleteExpiredRecords(database.db, new Date(time))).toEqual({ emailCodes: 0, sessions: 0 });
      const afterCodesExpire = new Date(time + 11 * 60_000);
      expect(await deleteExpiredRecords(database.db, afterCodesExpire)).toEqual({ emailCodes: 1, sessions: 0 });
      const afterSessionsExpire = new Date(time + 31 * 24 * 60 * 60_000);
      expect(await deleteExpiredRecords(database.db, afterSessionsExpire)).toEqual({ emailCodes: 0, sessions: 2 });
    });
  });
});
