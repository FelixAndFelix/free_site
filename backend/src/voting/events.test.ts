import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CourseEvent } from "@free-site/shared";
import { createDatabase } from "../database";
import type { Mail } from "../mail";
import { TEST_SETUP_CODE, createTestApp, registerUser, resetDatabase } from "../testHelpers";
import { createEventHub, type EventHub } from "./events";

interface OpenStream {
  status: number;
  /** Resolves with the next event of the given type, or rejects after a timeout. */
  next: (type: CourseEvent["type"]) => Promise<CourseEvent>;
  /** Resolves once the server has closed the stream. */
  closed: Promise<void>;
  close: () => void;
}

describe.skipIf(!process.env.DATABASE_URL)("live updates over SSE (real Postgres)", () => {
  const database = createDatabase(process.env.DATABASE_URL ?? "");
  let sentMails: Mail[];
  let time: number;
  let events: EventHub;
  let app: ReturnType<typeof createTestApp>;
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let studentCookie: string;
  let courseId: string;
  let moduleId: string;
  const openStreams: OpenStream[] = [];

  beforeAll(() => database.runMigrations());
  afterAll(() => database.close());

  beforeEach(async () => {
    await resetDatabase(database.db);
    sentMails = [];
    time = Date.parse("2026-10-01T10:00:00Z");
    events = createEventHub();
    app = createTestApp({ db: database.db, sentMails, now: () => new Date(time), events });
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    adminCookie = await registerUser(app, sentMails, { email: "admin@dhbw.example", adminSetupCode: TEST_SETUP_CODE });
    studentCookie = await registerUser(app, sentMails, { email: "student@dhbw.example" });
    const courses = await request(app).get("/api/admin/courses").set("Cookie", adminCookie);
    courseId = courses.body.courses[0].id;
    moduleId = await createModule(courseId, "Datenbanken");
  });

  afterEach(async () => {
    for (const stream of openStreams.splice(0)) stream.close();
    await new Promise((resolve) => server.close(resolve));
  });

  /** Creates a module as admin and returns its id. */
  async function createModule(inCourseId: string, name: string): Promise<string> {
    const response = await request(app)
      .post(`/api/admin/courses/${inCourseId}/modules`)
      .set("Cookie", adminCookie)
      .send({ name, semester: 1 });
    return response.body.module.id;
  }

  /**
   * Opens GET /api/events as a real streaming request and parses the SSE frames as they arrive.
   * @param {string | undefined} cookie
   */
  async function openStream(cookie?: string): Promise<OpenStream> {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/api/events`, {
      headers: cookie ? { Cookie: cookie } : {},
      signal: controller.signal,
    });
    const received: CourseEvent[] = [];
    const waiters: Array<{ type: string; resolve: (event: CourseEvent) => void }> = [];
    let resolveClosed = () => {};
    const closed = new Promise<void>((resolve) => (resolveClosed = resolve));

    /** Hands a parsed event to a waiting next() call, or keeps it for a later one. */
    function deliver(event: CourseEvent) {
      const index = waiters.findIndex((waiter) => waiter.type === event.type);
      if (index >= 0) waiters.splice(index, 1)[0]!.resolve(event);
      else received.push(event);
    }

    if (response.body && response.status === 200) {
      (async () => {
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          for await (const chunk of response.body!) {
            buffer += decoder.decode(chunk as Uint8Array, { stream: true });
            let end;
            while ((end = buffer.indexOf("\n\n")) >= 0) {
              const frame = buffer.slice(0, end);
              buffer = buffer.slice(end + 2);
              const data = frame.split("\n").find((line) => line.startsWith("data: "));
              if (data) deliver(JSON.parse(data.slice(6)) as CourseEvent);
            }
          }
        } catch {
          // Aborted by close().
        }
        resolveClosed();
      })();
    } else {
      resolveClosed();
    }

    const stream: OpenStream = {
      status: response.status,
      next: (type) => {
        const index = received.findIndex((event) => event.type === type);
        if (index >= 0) return Promise.resolve(received.splice(index, 1)[0]!);
        return new Promise((resolve, reject) => {
          waiters.push({ type, resolve });
          setTimeout(() => reject(new Error(`no ${type} event within 2 s`)), 2000);
        });
      },
      closed,
      close: () => controller.abort(),
    };
    openStreams.push(stream);
    return stream;
  }

  /** Waits until the hub has registered the given number of streams. */
  async function waitForStreams(count: number) {
    for (let attempt = 0; attempt < 50 && events.size() < count; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  it("requires a session", async () => {
    const stream = await openStream();
    expect(stream.status).toBe(401);
  });

  it("pushes the new counts to others in the course when someone votes", async () => {
    const watcher = await openStream(adminCookie);
    await waitForStreams(1);

    await request(app).put(`/api/modules/${moduleId}/vote`).set("Cookie", studentCookie).send({ value: "free" }).expect(200);

    expect(await watcher.next("module-votes")).toEqual({
      type: "module-votes",
      moduleId,
      counts: { free: 1, possible: 0, impossible: 0 },
    });
  });

  it("pushes withdrawn votes too", async () => {
    await request(app).put(`/api/modules/${moduleId}/vote`).set("Cookie", studentCookie).send({ value: "free" });
    const watcher = await openStream(adminCookie);
    await waitForStreams(1);
    time += 15 * 60_000;

    await request(app).delete(`/api/modules/${moduleId}/vote`).set("Cookie", studentCookie).expect(200);

    expect((await watcher.next("module-votes")) as { counts: object }).toMatchObject({
      counts: { free: 0, possible: 0, impossible: 0 },
    });
  });

  it("does not send events of other courses", async () => {
    const other = await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: "INF25A" });
    const foreignModuleId = await createModule(other.body.course.id, "Fremd");
    const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
    const admin = users.body.users.find((user: { email: string }) => user.email === "admin@dhbw.example");
    await request(app).put(`/api/admin/users/${admin.id}/course`).set("Cookie", adminCookie).send({ courseId: other.body.course.id });

    const watcher = await openStream(studentCookie);
    await waitForStreams(1);
    await request(app).put(`/api/modules/${foreignModuleId}/vote`).set("Cookie", adminCookie).send({ value: "free" }).expect(200);

    await expect(watcher.next("module-votes")).rejects.toThrow("no module-votes event");
  });

  it("tells the course when an admin adds or deletes a module", async () => {
    const watcher = await openStream(studentCookie);
    await waitForStreams(1);

    await createModule(courseId, "Mathematik I");
    expect(await watcher.next("modules-changed")).toEqual({ type: "modules-changed" });
    await request(app).delete(`/api/admin/modules/${moduleId}`).set("Cookie", adminCookie).expect(204);
    expect(await watcher.next("modules-changed")).toEqual({ type: "modules-changed" });
  });

  it("closes a user's streams when an admin moves them to another course", async () => {
    const other = await request(app).post("/api/admin/courses").set("Cookie", adminCookie).send({ name: "INF25A" });
    const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
    const student = users.body.users.find((user: { email: string }) => user.email === "student@dhbw.example");
    const watcher = await openStream(studentCookie);
    await waitForStreams(1);

    await request(app).put(`/api/admin/users/${student.id}/course`).set("Cookie", adminCookie).send({ courseId: other.body.course.id });

    await watcher.closed;
    expect(events.size()).toBe(0);
  });

  it("answers 204 to a user without a course, so the browser stops reconnecting", async () => {
    const users = await request(app).get("/api/admin/users").set("Cookie", adminCookie);
    const student = users.body.users.find((user: { email: string }) => user.email === "student@dhbw.example");
    await request(app).put(`/api/admin/users/${student.id}/course`).set("Cookie", adminCookie).send({ courseId: null });

    const stream = await openStream(studentCookie);
    expect(stream.status).toBe(204);
  });

  it("allows at most 5 open streams per user", async () => {
    for (let index = 0; index < 5; index++) expect((await openStream(studentCookie)).status).toBe(200);
    await waitForStreams(5);

    expect((await openStream(studentCookie)).status).toBe(429);
    expect((await openStream(adminCookie)).status).toBe(200);
  });

  it("forgets a stream when the browser disconnects", async () => {
    const watcher = await openStream(studentCookie);
    await waitForStreams(1);

    watcher.close();
    for (let attempt = 0; attempt < 50 && events.size() > 0; attempt++) await new Promise((resolve) => setTimeout(resolve, 20));
    expect(events.size()).toBe(0);
  });
});
