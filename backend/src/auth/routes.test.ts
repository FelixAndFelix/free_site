import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../database";
import type { Mail } from "../mail";
import {
  TEST_COURSE_CODE as COURSE_CODE,
  TEST_PASSWORD as PASSWORD,
  TEST_SETUP_CODE,
  createTestApp,
  lastCode as lastCodeOf,
  registerUser,
  resetDatabase,
  sessionCookie,
} from "../testHelpers";

const EMAIL = "student@dhbw.example";

describe.skipIf(!process.env.DATABASE_URL)("auth routes (real Postgres)", () => {
  const database = createDatabase(process.env.DATABASE_URL ?? "");
  let sentMails: Mail[];
  let time: number;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => database.runMigrations());
  afterAll(() => database.close());

  beforeEach(async () => {
    await resetDatabase(database.db);
    sentMails = [];
    time = Date.parse("2026-01-01T00:00:00Z");
    app = createTestApp({ db: database.db, sentMails, now: () => new Date(time) });
  });

  /** Extracts the 6-digit code from the last mail sent. */
  function lastCode(): string {
    return lastCodeOf(sentMails);
  }

  /** Registers a user (the default one unless an email is given) and returns its session cookie. */
  function register(email = EMAIL, adminSetupCode?: string): Promise<string> {
    return registerUser(app, sentMails, { email, adminSetupCode });
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
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, username: "student", courseCode: COURSE_CODE });
      const response = await request(app)
        .post("/api/auth/register/complete")
        .send({ email: EMAIL, username: "student", courseCode: COURSE_CODE, code: lastCode(), password: PASSWORD });

      const cookie = (response.headers["set-cookie"] as unknown as string[])[0]!;
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
    });

    it("rejects a domain outside the allowlist without sending mail", async () => {
      const response = await request(app)
        .post("/api/auth/register/start")
        .send({ email: "student@dhbw.example.evil.com", username: "student", courseCode: COURSE_CODE });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "email_domain_not_allowed" });
      expect(sentMails).toHaveLength(0);
    });

    it("rejects an unknown course code without sending mail", async () => {
      const response = await request(app).post("/api/auth/register/start").send({ email: EMAIL, username: "student", courseCode: "NOPE" });

      expect(response.body).toEqual({ error: "invalid_course_code" });
      expect(sentMails).toHaveLength(0);
    });

    it("rejects a password shorter than 10 characters", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, username: "student", courseCode: COURSE_CODE });
      const response = await request(app)
        .post("/api/auth/register/complete")
        .send({ email: EMAIL, username: "student", courseCode: COURSE_CODE, code: lastCode(), password: "short" });

      expect(response.body).toEqual({ error: "invalid_password" });
    });

    it("answers an already registered email the same way but sends no mail", async () => {
      await register();
      sentMails = [];

      await request(app)
        .post("/api/auth/register/start")
        .send({ email: EMAIL, username: "someone_else", courseCode: COURSE_CODE })
        .expect(202);
      expect(sentMails).toHaveLength(0);
    });

    it("sends at most one code per address per 60 seconds", async () => {
      const start = () => request(app).post("/api/auth/register/start").send({ email: EMAIL, username: "student", courseCode: COURSE_CODE });
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
          .send({ email: `s${index}@dhbw.example`, username: "student", courseCode: COURSE_CODE })
          .expect(202);
      }
      const response = await request(app).post("/api/auth/register/start").send({ email: EMAIL, username: "student", courseCode: COURSE_CODE });
      expect(response.status).toBe(429);
    });

    it("counts the IP limit per client address forwarded by a trusted proxy", async () => {
      /** Requests a code as if forwarded for the given client address. */
      const startFrom = (clientIp: string, index: number) =>
        request(app)
          .post("/api/auth/register/start")
          .set("X-Forwarded-For", clientIp)
          .send({ email: `s${index}@dhbw.example`, username: "student", courseCode: COURSE_CODE });

      for (let index = 0; index < 5; index++) await startFrom("203.0.113.1", index).expect(202);
      await startFrom("203.0.113.1", 5).expect(429);
      await startFrom("203.0.113.2", 6).expect(202);
    });
  });

  describe("abuse limits", () => {
    it("sends at most 5 codes per address per hour, even from many IPs, with an unchanged answer", async () => {
      /** Requests a registration code for the default address from a given client IP. */
      const startFrom = (clientIp: string) =>
        request(app)
          .post("/api/auth/register/start")
          .set("X-Forwarded-For", clientIp)
          .send({ email: EMAIL, username: "student", courseCode: COURSE_CODE });

      for (let index = 0; index < 7; index++) {
        await startFrom(`203.0.113.${index + 1}`).expect(202);
        time += 61_000;
      }
      expect(sentMails).toHaveLength(5);

      time += 60 * 60_000;
      await startFrom("203.0.113.99").expect(202);
      expect(sentMails).toHaveLength(6);
    });

    it("limits failed logins per IP, across many accounts (password spraying)", async () => {
      /** Tries a wrong password for a different address each time from one IP. */
      const spray = (index: number) =>
        request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", "203.0.113.7")
          .send({ email: `victim${index}@dhbw.example`, password: "Summer2026!" });

      for (let index = 0; index < 20; index++) await spray(index).expect(401);
      await spray(20).expect(429);

      const otherIp = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "203.0.113.8")
        .send({ email: "victim0@dhbw.example", password: "Summer2026!" });
      expect(otherIp.status).toBe(401);
      time += 15 * 60_000;
      await spray(21).expect(401);
    });

    it("does not count successful logins towards the per-IP limit", async () => {
      await register();
      for (let index = 0; index < 25; index++) {
        await request(app).post("/api/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(200);
      }
    });

    it("allows at most 10 username changes per day", async () => {
      const cookie = await register();
      for (let index = 0; index < 10; index++) {
        await request(app).put("/api/auth/username").set("Cookie", cookie).send({ username: `name${index}` }).expect(200);
      }
      await request(app).put("/api/auth/username").set("Cookie", cookie).send({ username: "name10" }).expect(429);

      time += 24 * 60 * 60_000;
      await request(app).put("/api/auth/username").set("Cookie", cookie).send({ username: "name10" }).expect(200);
    });
  });

  describe("email codes", () => {
    /** Tries to complete the registration with the given code. */
    function complete(code: string, username = "student") {
      return request(app)
        .post("/api/auth/register/complete")
        .send({ email: EMAIL, username, courseCode: COURSE_CODE, code, password: PASSWORD });
    }

    /** A 6-digit code guaranteed to differ from the real one. */
    function wrongCode(code: string): string {
      return code === "000000" ? "111111" : "000000";
    }

    it("is single-use", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, username: "student", courseCode: COURSE_CODE });
      const code = lastCode();
      await complete(code).expect(201);
      expect((await complete(code, "another_name")).body).toEqual({ error: "invalid_code" });
    });

    it("expires after 10 minutes", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, username: "student", courseCode: COURSE_CODE });
      time += 10 * 60_000;
      expect((await complete(lastCode())).body).toEqual({ error: "invalid_code" });
    });

    it("is invalidated after 5 wrong attempts", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, username: "student", courseCode: COURSE_CODE });
      const code = lastCode();
      for (let attempt = 0; attempt < 5; attempt++) await complete(wrongCode(code)).expect(400);
      expect((await complete(code)).body).toEqual({ error: "invalid_code" });
    });

    it("still accepts the right code after 4 wrong attempts", async () => {
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, username: "student", courseCode: COURSE_CODE });
      const code = lastCode();
      for (let attempt = 0; attempt < 4; attempt++) await complete(wrongCode(code)).expect(400);
      await complete(code).expect(201);
    });
  });

  describe("usernames", () => {
    it("stores the username and returns it with the user", async () => {
      const cookie = await register(EMAIL);

      const me = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
      expect(me.body.user).toMatchObject({ email: EMAIL, username: "student" });
    });

    it("rejects a username that breaks the rules before sending mail", async () => {
      for (const username of ["ab", "has space", "a".repeat(21), "semi;colon"]) {
        const response = await request(app)
          .post("/api/auth/register/start")
          .send({ email: EMAIL, username, courseCode: COURSE_CODE });
        expect(response.body).toEqual({ error: "invalid_username" });
      }
      expect(sentMails).toHaveLength(0);
    });

    it("accepts umlauts, digits, dots, underscores and hyphens", async () => {
      await registerUser(app, sentMails, { email: EMAIL, username: "Jürgen.M_2-b" });
    });

    it("rejects a username that is taken, ignoring upper and lower case", async () => {
      await registerUser(app, sentMails, { email: "first@dhbw.example", username: "Felix" });
      const response = await request(app)
        .post("/api/auth/register/start")
        .send({ email: EMAIL, username: "felix", courseCode: COURSE_CODE });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "username_taken" });
    });

    it("lets a logged-in user set or change their username", async () => {
      const cookie = await register(EMAIL);
      const response = await request(app)
        .put("/api/auth/username")
        .set("Cookie", cookie)
        .send({ username: "  new_name  " })
        .expect(200);

      expect(response.body.user.username).toBe("new_name");
      const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
      expect(me.body.user.username).toBe("new_name");
    });

    it("allows keeping your own username in different case, but not taking someone else's", async () => {
      await registerUser(app, sentMails, { email: "first@dhbw.example", username: "Felix" });
      const cookie = await register(EMAIL);

      await request(app).put("/api/auth/username").set("Cookie", cookie).send({ username: "STUDENT" }).expect(200);
      const taken = await request(app).put("/api/auth/username").set("Cookie", cookie).send({ username: "FELIX" });
      expect(taken.body).toEqual({ error: "username_taken" });
    });

    it("requires a session to set a username", async () => {
      await request(app).put("/api/auth/username").send({ username: "someone" }).expect(401);
    });
  });

  describe("admin setup code", () => {
    it("makes the first registration with the right code an admin", async () => {
      const cookie = await register(EMAIL, TEST_SETUP_CODE);

      const me = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
      expect(me.body.user.role).toBe("admin");
    });

    it("rejects a wrong setup code before sending mail", async () => {
      const response = await request(app)
        .post("/api/auth/register/start")
        .send({ email: EMAIL, username: "student", courseCode: COURSE_CODE, adminSetupCode: "wrong" });

      expect(response.body).toEqual({ error: "invalid_setup_code" });
      expect(sentMails).toHaveLength(0);
    });

    it("stops working once an admin exists", async () => {
      await register("first@dhbw.example", TEST_SETUP_CODE);
      const response = await request(app)
        .post("/api/auth/register/start")
        .send({ email: EMAIL, username: "student", courseCode: COURSE_CODE, adminSetupCode: TEST_SETUP_CODE });

      expect(response.body).toEqual({ error: "invalid_setup_code" });
    });

    it("registers a normal user when the field is empty", async () => {
      const cookie = await register(EMAIL, "");

      const me = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
      expect(me.body.user.role).toBe("user");
    });
  });

  describe("claiming admin with the setup code", () => {
    it("makes an existing user admin while no admin exists", async () => {
      const cookie = await register();
      const response = await request(app)
        .post("/api/auth/claim-admin")
        .set("Cookie", cookie)
        .send({ adminSetupCode: TEST_SETUP_CODE })
        .expect(200);

      expect(response.body.user.role).toBe("admin");
      const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
      expect(me.body.user.role).toBe("admin");
    });

    it("refuses once an admin exists", async () => {
      await register("first@dhbw.example", TEST_SETUP_CODE);
      const cookie = await register();
      const response = await request(app)
        .post("/api/auth/claim-admin")
        .set("Cookie", cookie)
        .send({ adminSetupCode: TEST_SETUP_CODE });

      expect(response.body).toEqual({ error: "invalid_setup_code" });
    });

    it("requires a session", async () => {
      await request(app).post("/api/auth/claim-admin").send({ adminSetupCode: TEST_SETUP_CODE }).expect(401);
    });

    it("limits attempts to 5 per IP per hour", async () => {
      const cookie = await register();
      for (let attempt = 0; attempt < 5; attempt++) {
        await request(app).post("/api/auth/claim-admin").set("Cookie", cookie).send({ adminSetupCode: "x" }).expect(400);
      }
      await request(app)
        .post("/api/auth/claim-admin")
        .set("Cookie", cookie)
        .send({ adminSetupCode: TEST_SETUP_CODE })
        .expect(429);
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
      await request(app).post("/api/auth/register/start").send({ email: EMAIL, username: "student", courseCode: COURSE_CODE });
      const registerCode = lastCode();
      await request(app)
        .post("/api/auth/register/complete")
        .send({ email: EMAIL, username: "student", courseCode: COURSE_CODE, code: registerCode, password: PASSWORD });
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
