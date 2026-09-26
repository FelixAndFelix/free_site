import { afterAll, describe, expect, it } from "vitest";
import { createDatabase } from "./database";

describe.skipIf(!process.env.DATABASE_URL)("database (real Postgres)", () => {
  const database = createDatabase(process.env.DATABASE_URL ?? "");

  afterAll(() => database.close());

  it("reports reachable when Postgres answers", async () => {
    expect(await database.check()).toBe(true);
  });

  it("reports unreachable for a dead connection", async () => {
    const dead = createDatabase("postgres://nobody:nothing@127.0.0.1:1/none");
    expect(await dead.check()).toBe(false);
    await dead.close();
  });
});
