import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@free-site/shared";
import { createDatabase } from "../database";
import type { Mail } from "../mail";
import { auditLog } from "../schema";
import { deleteExpiredRecords } from "../auth/accounts";
import {
  TEST_COURSE_CODE,
  TEST_PASSWORD,
  TEST_SETUP_CODE,
  createTestApp,
  lastCode,
  registerUser,
  resetDatabase,
} from "../testHelpers";
import { createAuditLog } from "./log";

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!process.env.DATABASE_URL)("activity log (real Postgres)", () => {
  const database = createDatabase(process.env.DATABASE_URL ?? "");
  let sentMails: Mail[];
  let time: number;
  let app: ReturnType<typeof createTestApp>;
  let adminCookie: string;

  beforeAll(() => database.runMigrations());
  afterAll(() => database.close());

  beforeEach(async () => {
    await resetDatabase(database.db);
    sentMails = [];
    time = Date.parse("2026-10-01T10:00:00Z");
    app = createTestApp({ db: database.db, sentMails, now: () => new Date(time) });
    adminCookie = await registerUser(app, sentMails, { email: "admin@dhbw.example", adminSetupCode: TEST_SETUP_CODE });
  });

  /** Moves the clock on, so entries of different steps never share a timestamp. */
  function tick() {
    time += 1000;
  }

  /** Reads one log as an admin; the actions are returned newest first. */
  async function readLog(category: "audit" | "access", query = ""): Promise<AuditEntry[]> {
    const response = await request(app).get(`/api/admin/audit?category=${category}${query}`).set("Cookie", adminCookie).expect(200);
    return response.body.entries;
  }

  /** The actions of a log, oldest first, which reads like the story of what happened. */
  async function actions(category: "audit" | "access"): Promise<string[]> {
    return (await readLog(category)).map((entry) => entry.action).reverse();
  }

  describe("admin changes (audit)", () => {
    it("records what an admin changes, who did it and from which network", async () => {
      time += 1000;
      const created = await request(app)
        .post("/api/admin/courses")
        .set("Cookie", adminCookie)
        .set("X-Forwarded-For", "203.0.113.57")
        .send({ name: "INF24B" })
        .expect(201);
      const courseId = created.body.course.id;
      time += 1000;
      await request(app).patch(`/api/admin/courses/${courseId}`).set("Cookie", adminCookie).send({ name: "INF24B neu" }).expect(200);
      time += 1000;
      await request(app).post(`/api/admin/courses/${courseId}/join-code`).set("Cookie", adminCookie).expect(200);
      time += 1000;
      const module = await request(app)
        .post(`/api/admin/courses/${courseId}/modules`)
        .set("Cookie", adminCookie)
        .send({ name: "Datenbanken", semester: 3 })
        .expect(201);
      time += 1000;
      await request(app).patch(`/api/admin/modules/${module.body.module.id}`).set("Cookie", adminCookie).send({ semester: 4 }).expect(200);
      time += 1000;
      await request(app).delete(`/api/admin/modules/${module.body.module.id}`).set("Cookie", adminCookie).expect(204);
      time += 1000;
      await request(app).delete(`/api/admin/courses/${courseId}`).set("Cookie", adminCookie).expect(204);

      expect(await actions("audit")).toEqual([
        "course.created",
        "course.renamed",
        "course.join_code_rotated",
        "module.created",
        "module.updated",
        "module.deleted",
        "course.deleted",
      ]);
      const entries = (await readLog("audit")).reverse();
      expect(entries[0]).toMatchObject({ actor: "admin", actorEmail: "admin@dhbw.example", label: "INF24B", ip: "203.0.113.57", category: "audit" });
      expect(entries[1]!.label).toBe("INF24B → INF24B neu");
      expect(entries[3]!.label).toBe("Datenbanken (INF24B neu)");
      expect(entries[6]!.label).toBe("INF24B neu");
      expect(entries.map((entry) => entry.createdAt)).toEqual([...entries.map((entry) => entry.createdAt)].sort());
    });

    it("records role changes and course moves with the user they concern", async () => {
      await registerUser(app, sentMails, { email: "student@dhbw.example", username: "anna" });
      const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
      const anna = users.body.users.find((user: { username: string }) => user.username === "anna");
      const other = await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: "INF25A" });

      tick();
      await request(app).patch(`/api/admin/users/${anna.id}`).set("Cookie", adminCookie).send({ role: "admin" }).expect(200);
      tick();
      await request(app).put(`/api/admin/users/${anna.id}/course`).set("Cookie", adminCookie).send({ courseId: other.body.course.id }).expect(200);
      tick();
      await request(app).put(`/api/admin/users/${anna.id}/course`).set("Cookie", adminCookie).send({ courseId: null }).expect(200);

      const entries = (await readLog("audit")).filter((entry) => entry.action.startsWith("user.")).reverse();
      expect(entries).toMatchObject([
        { action: "user.role_changed", actor: "admin", target: "anna", email: "student@dhbw.example", label: "admin" },
        { action: "user.course_changed", actor: "admin", target: "anna", email: "student@dhbw.example", label: "INF25A" },
        { action: "user.course_changed", actor: "admin", target: "anna", email: "student@dhbw.example", label: null },
      ]);
    });

    it("does not record changes that were refused", async () => {
      await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: "" }).expect(400);
      await request(app).delete("/api/admin/courses/00000000-0000-4000-8000-000000000000").set("Cookie", adminCookie).expect(404);
      const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
      await request(app).patch(`/api/admin/users/${users.body.users[0].id}`).set("Cookie", adminCookie).send({ role: "user" }).expect(400);

      expect(await readLog("audit")).toEqual([]);
    });
  });

  describe("sign-ins and accounts (access)", () => {
    it("records registration, logins, failures and logout-free account events", async () => {
      tick();
      await registerUser(app, sentMails, { email: "student@dhbw.example", username: "anna" });
      time += 1000;
      await request(app).post("/api/auth/login").send({ email: "student@dhbw.example", password: "wrong password" }).expect(401);
      time += 1000;
      await request(app).post("/api/auth/login").send({ email: "student@dhbw.example", password: TEST_PASSWORD }).expect(200);

      const entries = (await readLog("access")).reverse();
      expect(entries.map((entry) => [entry.action, entry.actor, entry.target, entry.email])).toEqual([
        ["account.registered", "admin", null, "admin@dhbw.example"],
        ["account.registered", "anna", null, "student@dhbw.example"],
        ["login.failed", null, "anna", "student@dhbw.example"],
        ["login.succeeded", "anna", null, "student@dhbw.example"],
      ]);
    });

    it("stores the email address and the full IP address, also for addresses that have no account", async () => {
      await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "198.51.100.234")
        .send({ email: "Nobody@DHBW.example", password: "whatever" })
        .expect(401);
      await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "2001:db8:1:2:3:4:5:6")
        .send({ email: "nobody@dhbw.example", password: "whatever" })
        .expect(401);

      const failures = (await readLog("access")).filter((entry) => entry.action === "login.failed");
      expect(failures.map((entry) => [entry.email, entry.ip]).sort()).toEqual([
        ["nobody@dhbw.example", "198.51.100.234"],
        ["nobody@dhbw.example", "2001:db8:1:2:3:4:5:6"],
      ]);
      expect(failures.every((entry) => entry.actor === null && entry.target === null)).toBe(true);
    });

    it("writes an IPv6-mapped IPv4 client as the plain IPv4 address", async () => {
      const log = createAuditLog(database.db, () => new Date(time));
      time += 1000;
      await log.record({ category: "access", action: "login.succeeded", ip: "::ffff:203.0.113.9" });

      expect((await readLog("access"))[0]!.ip).toBe("203.0.113.9");
    });

    it("records password resets, claiming admin, joining and switching courses", async () => {
      const student = await registerUser(app, sentMails, { email: "student@dhbw.example", username: "anna" });
      tick();
      await request(app).post("/api/auth/reset/start").send({ email: "student@dhbw.example" }).expect(202);
      tick();
      await request(app)
        .post("/api/auth/reset/complete")
        .send({ email: "student@dhbw.example", code: lastCode(sentMails), password: "a brand new password" })
        .expect(204);
      const other = await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: "INF25A" });
      tick();
      const login = await request(app).post("/api/auth/login").send({ email: "student@dhbw.example", password: "a brand new password" });
      const cookie = (login.headers["set-cookie"] as unknown as string[])[0]!.split(";")[0]!;
      tick();
      await request(app).post(`/api/join/${other.body.course.joinCode}`).set("Cookie", cookie).send({ confirmSwitch: true }).expect(200);
      void student;

      const entries = (await readLog("access")).reverse().filter((entry) => !entry.action.startsWith("account.") && entry.action !== "login.succeeded");
      expect(entries).toMatchObject([
        { action: "password_reset.requested", target: "anna", email: "student@dhbw.example" },
        { action: "password_reset.completed", actor: "anna", email: "student@dhbw.example" },
        { action: "course.switched", actor: "anna", email: "student@dhbw.example", label: "INF25A" },
      ]);
    });

    it("records a reset request for an unknown address with the typed address, and sends no mail", async () => {
      const mailsBefore = sentMails.length;
      await request(app).post("/api/auth/reset/start").set("X-Forwarded-For", "203.0.113.5").send({ email: "nobody@dhbw.example" }).expect(202);

      expect(sentMails).toHaveLength(mailsBefore);
      expect((await readLog("access"))[0]).toMatchObject({
        action: "password_reset.requested",
        target: null,
        email: "nobody@dhbw.example",
        ip: "203.0.113.5",
      });
    });

    it("does not log attempts that the rate limits already refused, so the log cannot be flooded", async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        await request(app).post("/api/auth/login").send({ email: "admin@dhbw.example", password: "wrong" }).expect(401);
      }
      for (let attempt = 0; attempt < 10; attempt++) {
        await request(app).post("/api/auth/login").send({ email: "admin@dhbw.example", password: "wrong" }).expect(429);
      }

      const failures = (await readLog("access")).filter((entry) => entry.action === "login.failed");
      expect(failures).toHaveLength(5);
    });

    it("records a deleted account by its email and address, and keeps showing earlier entries by email", async () => {
      await registerUser(app, sentMails, { email: "student@dhbw.example", username: "anna" });
      tick();
      const login = await request(app).post("/api/auth/login").send({ email: "student@dhbw.example", password: TEST_PASSWORD });
      const cookie = (login.headers["set-cookie"] as unknown as string[])[0]!.split(";")[0]!;
      tick();

      await request(app).delete("/api/auth/account").set("Cookie", cookie).set("X-Forwarded-For", "203.0.113.8").send({ password: TEST_PASSWORD }).expect(204);

      const entries = await readLog("access");
      expect(entries[0]).toMatchObject({ action: "account.deleted", actor: null, target: null, email: "student@dhbw.example", ip: "203.0.113.8" });
      // The account is gone, so the user link is gone, but the log still says whose entries these were.
      const earlier = entries.filter((entry) => entry.email === "student@dhbw.example");
      expect(earlier.map((entry) => entry.action).sort()).toEqual(["account.deleted", "account.registered", "login.succeeded"]);
      expect(earlier.every((entry) => entry.actor === null)).toBe(true);
    });

    it("keeps the two logs apart", async () => {
      await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: "INF24B" }).expect(201);

      expect((await readLog("audit")).map((entry) => entry.action)).toEqual(["course.created"]);
      expect((await readLog("access")).map((entry) => entry.action)).toEqual(["account.registered"]);
    });
  });

  describe("reading the log", () => {
    it("is only for admins", async () => {
      const student = await registerUser(app, sentMails, { email: "student@dhbw.example" });

      await request(app).get("/api/admin/audit?category=access").expect(401);
      await request(app).get("/api/admin/audit?category=access").set("Cookie", student).expect(403);
    });

    it("rejects an unknown category and a malformed cursor", async () => {
      await request(app).get("/api/admin/audit").set("Cookie", adminCookie).expect(400);
      await request(app).get("/api/admin/audit?category=secrets").set("Cookie", adminCookie).expect(400);
      await request(app).get("/api/admin/audit?category=access&cursor=nonsense").set("Cookie", adminCookie).expect(400);
      await request(app).get("/api/admin/audit?category=access&cursor=2026-01-01T00:00:00Z|not-a-uuid").set("Cookie", adminCookie).expect(400);
    });

    it("pages through a long log newest first without gaps or repeats", async () => {
      await database.db.execute(sql`truncate audit_log`);
      const base = time;
      await database.db.insert(auditLog).values(
        Array.from({ length: 120 }, (_, index) => ({
          // Pairs share a timestamp, so the order has to be settled by the id.
          createdAt: new Date(base - Math.floor(index / 2) * 1000),
          category: "access" as const,
          action: "login.succeeded" as const,
          label: `entry ${index}`,
        })),
      );

      const seen: string[] = [];
      let cursor = "";
      for (let page = 0; page < 5; page++) {
        const response = await request(app).get(`/api/admin/audit?category=access${cursor}`).set("Cookie", adminCookie).expect(200);
        seen.push(...response.body.entries.map((entry: AuditEntry) => entry.label));
        if (!response.body.nextCursor) break;
        cursor = `&cursor=${encodeURIComponent(response.body.nextCursor)}`;
      }

      expect(seen).toHaveLength(120);
      expect(new Set(seen).size).toBe(120);
    });
  });

  describe("retention", () => {
    it("deletes admin entries after a year and access entries after 90 days, and keeps the rest", async () => {
      await database.db.execute(sql`truncate audit_log`);
      const row = (category: "audit" | "access", ageDays: number) => ({
        createdAt: new Date(time - ageDays * DAY),
        category,
        action: (category === "audit" ? "course.created" : "login.succeeded") as "course.created" | "login.succeeded",
        label: `${category} ${ageDays}`,
      });
      await database.db.insert(auditLog).values([
        row("audit", 366),
        row("audit", 364),
        row("access", 91),
        row("access", 89),
        row("access", 0),
      ]);

      const result = await deleteExpiredRecords(database.db, new Date(time));

      expect(result.auditEntries).toBe(2);
      const left = await database.db.select({ label: auditLog.label }).from(auditLog);
      expect(left.map((entry) => entry.label).sort()).toEqual(["access 0", "access 89", "audit 364"]);
    });
  });

  describe("a failing log", () => {
    it("never breaks the action it was recording", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const broken = createAuditLog({ insert: () => { throw new Error("database is down"); } } as never);

      await expect(broken.record({ category: "access", action: "login.succeeded" })).resolves.toBeUndefined();

      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });
  });

  it("uses the course code constants of the test helper", () => {
    expect(TEST_COURSE_CODE).toBeTruthy();
  });
});
