import { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("GET /api/health", () => {
  it("returns 200 and ok when the database is reachable", async () => {
    const app = createApp({ checkDatabase: async () => true, authRouter: Router(), adminRouter: Router(), joinRouter: Router(), votingRouter: Router() });

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", database: true });
  });

  it("returns 503 and degraded when the database is unreachable", async () => {
    const app = createApp({ checkDatabase: async () => false, authRouter: Router(), adminRouter: Router(), joinRouter: Router(), votingRouter: Router() });

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "degraded", database: false });
  });
});
