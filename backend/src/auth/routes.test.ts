import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createDatabase } from "../database";
import type { Mail } from "../mail";
import { courses } from "../schema";
import { createAuthRouter } from "./routes";

const PASSWORD = "correct horse battery";
const EMAIL = "student@dhbw.example";
const COURSE_CODE = "WS24-123";

describe.skipIf(!process.env.DATABASE_URL)("auth routes (real Postgres)", () => {
  const database = createDatabase(process.env.DATABASE_URL ?? "");
  let sentMails: Mail[];
  let time: number;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => database.runMigrations());
  afterAll(() => database.close());

  beforeEach(async () => {
    await database.db.execute(sql`truncate users, courses, email_codes, sessions cascade`);
    await database.db.insert(courses).values({ name: "WWI 2024", joinCode: COURSE_CODE });
    sentMails = [];
    time = Date.parse("2026-01-01T00:00:00Z");
    const authRouter = createAuthRouter({
      db: database.db,
      sendMail: async (mail) => void sentMails.push(mail),
      allowedEmailDomains: ["dhbw.example"],
      secureCookies: false,
      now: () => new Date(time),
    });
    app = createApp({ checkDatabase: async () => true, authRouter, trustProxy: "loopback" });
  });

  /** Extracts the 6-digit code from the last mail sent. */
  function lastCode(): string {
    return /\d{6}/.exec(sentMails.at(-1)?.text ?? "")![0];
  }

  /** Extracts the session cookie pair from a response. */
  function sessionCookie(response: request.Response): string {
    const cookies = response.headers["set-cookie"] as unknown as string[];
    return cookies.find((cookie) => cookie.startsWith("session="))!.split(";")[0]!;
  }

  /** Registers the default user and returns its session cookie. */
  async function register(email = EMAIL): Promise<string> {
    await request(app).post("/api/auth/register/start").send({ email, courseCode: COURSE_CODE }).expect(202);
    const response = await request(app)
      .post("/api/auth/register/complete")
      .send({ email, courseCode: COURSE_CODE, code: lastCode(), password: PASSWORD })
      .expect(201);
    return sessionCookie(response);
  }

  describe("registration", () => {
    it("registers with an emailed code and starts a session", async () => {
      const cookie = await register(" Student@DHBW.example ");

      const me = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
      expect(me.body.user).toMatchObject({ email: EMAIL, role: "user" });
      const members = await database.db.execute(sql`select count(*)::int as count from course_members`);
      expect(members.rows[0]).toEqual({ count: 1 });
    });

    it("sets an HttpOnly, SameSite=Lax session cookie", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, courseCode: COURSE_CODE });
      const response = await request(app)
        .post("/api/auth/register/complete")
        .send({ email: EMAIL, courseCode: COURSE_CODE, code: lastCode(), password: PASSWORD });

      const cookie = (response.headers["set-cookie"] as unknown as string[])[0]!;
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
    });

    it("rejects a domain outside the allowlist without sending mail", async () => {
      const response = await request(app)
        .post("/api/auth/register/start")
        .send({ email: "student@dhbw.example.evil.com", courseCode: COURSE_CODE });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "email_domain_not_allowed" });
      expect(sentMails).toHaveLength(0);
    });

    it("rejects an unknown course code without sending mail", async () => {
      const response = await request(app).post("/api/auth/register/start").send({ email: EMAIL, courseCode: "NOPE" });

      expect(response.body).toEqual({ error: "invalid_course_code" });
      expect(sentMails).toHaveLength(0);
    });

    it("rejects a password shorter than 10 characters", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, courseCode: COURSE_CODE });
      const response = await request(app)
        .post("/api/auth/register/complete")
        .send({ email: EMAIL, courseCode: COURSE_CODE, code: lastCode(), password: "short" });

      expect(response.body).toEqual({ error: "invalid_password" });
    });

    it("answers an already registered email the same way but sends no mail", async () => {
      await register();
      sentMails = [];

      await request(app).post("/api/auth/register/start").send({ email: EMAIL, courseCode: COURSE_CODE }).expect(202);
      expect(sentMails).toHaveLength(0);
    });

    it("sends at most one code per address per 60 seconds", async () => {
      const start = () => request(app).post("/api/auth/register/start").send({ email: EMAIL, courseCode: COURSE_CODE });
      await start();
      await start();
      expect(sentMails).toHaveLength(1);

      time += 60_000;
      await start();
      expect(sentMails).toHaveLength(2);
    });

    it("limits code requests to 5 per IP per hour", async () => {
      for (let index = 0; index < 5; index++) {
        await request(app)
          .post("/api/auth/register/start")
          .send({ email: `s${index}@dhbw.example`, courseCode: COURSE_CODE })
          .expect(202);
      }
      const response = await request(app).post("/api/auth/register/start").send({ email: EMAIL, courseCode: COURSE_CODE });
      expect(response.status).toBe(429);
    });

    it("counts the IP limit per client address forwarded by a trusted proxy", async () => {
      /** Requests a code as if forwarded for the given client address. */
      const startFrom = (clientIp: string, index: number) =>
        request(app)
          .post("/api/auth/register/start")
          .set("X-Forwarded-For", clientIp)
          .send({ email: `s${index}@dhbw.example`, courseCode: COURSE_CODE });

      for (let index = 0; index < 5; index++) await startFrom("203.0.113.1", index).expect(202);
      await startFrom("203.0.113.1", 5).expect(429);
      await startFrom("203.0.113.2", 6).expect(202);
    });
  });

  describe("email codes", () => {
    /** Tries to complete the registration with the given code. */
    function complete(code: string) {
      return request(app)
        .post("/api/auth/register/complete")
        .send({ email: EMAIL, courseCode: COURSE_CODE, code, password: PASSWORD });
    }

    /** A 6-digit code guaranteed to differ from the real one. */
    function wrongCode(code: string): string {
      return code === "000000" ? "111111" : "000000";
    }

    it("is single-use", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, courseCode: COURSE_CODE });
      const code = lastCode();
      await complete(code).expect(201);
      expect((await complete(code)).body).toEqual({ error: "invalid_code" });
    });

    it("expires after 10 minutes", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, courseCode: COURSE_CODE });
      time += 10 * 60_000;
      expect((await complete(lastCode())).body).toEqual({ error: "invalid_code" });
    });

    it("is invalidated after 5 wrong attempts", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, courseCode: COURSE_CODE });
      const code = lastCode();
      for (let attempt = 0; attempt < 5; attempt++) await complete(wrongCode(code)).expect(400);
      expect((await complete(code)).body).toEqual({ error: "invalid_code" });
    });

    it("still accepts the right code after 4 wrong attempts", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, courseCode: COURSE_CODE });
      const code = lastCode();
      for (let attempt = 0; attempt < 4; attempt++) await complete(wrongCode(code)).expect(400);
      await complete(code).expect(201);
    });
  });

  describe("login and logout", () => {
    it("logs in with email and password", async () => {
      await register();
      const response = await request(app).post("/api/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(200);

      await request(app).get("/api/auth/me").set("Cookie", sessionCookie(response)).expect(200);
    });

    it("gives the same answer for a wrong password and an unknown email", async () => {
      await register();
      const wrongPassword = await request(app).post("/api/auth/login").send({ email: EMAIL, password: "wrong password" });
      const unknownEmail = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@dhbw.example", password: PASSWORD });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });

    it("throttles an email after 5 failures, even for the right password", async () => {
      await register();
      for (let attempt = 0; attempt < 5; attempt++) {
        await request(app).post("/api/auth/login").send({ email: EMAIL, password: "wrong password" }).expect(401);
      }
      await request(app).post("/api/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(429);

      time += 30_000;
      await request(app).post("/api/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(200);
    });

    it("ends the session on logout", async () => {
      const cookie = await register();
      await request(app).post("/api/auth/logout").set("Cookie", cookie).expect(204);
      await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
    });

    it("rejects an expired session", async () => {
      const cookie = await register();
      time += 30 * 24 * 60 * 60_000;
      await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
    });
  });

  describe("password reset", () => {
    it("sets a new password and revokes all sessions", async () => {
      const cookie = await register();
      await request(app).post("/api/auth/reset/start").send({ email: EMAIL }).expect(202);
      await request(app)
        .post("/api/auth/reset/complete")
        .send({ email: EMAIL, code: lastCode(), password: "a brand new password" })
        .expect(204);

      await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
      await request(app).post("/api/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(401);
      await request(app).post("/api/auth/login").send({ email: EMAIL, password: "a brand new password" }).expect(200);
    });

    it("answers an unknown email the same way without sending mail", async () => {
      const response = await request(app).post("/api/auth/reset/start").send({ email: "nobody@dhbw.example" });

      expect(response.status).toBe(202);
      expect(sentMails).toHaveLength(0);
    });

    it("does not accept a registration code for a reset", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, courseCode: COURSE_CODE });
      const registerCode = lastCode();
      await request(app)
        .post("/api/auth/register/complete")
        .send({ email: EMAIL, courseCode: COURSE_CODE, code: registerCode, password: PASSWORD });
      const response = await request(app)
        .post("/api/auth/reset/complete")
        .send({ email: EMAIL, code: registerCode, password: "a brand new password" });

      expect(response.body).toEqual({ error: "invalid_code" });
    });
  });

  it("answers a malformed body with invalid_request", async () => {
    const response = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{oops");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
  });
});
