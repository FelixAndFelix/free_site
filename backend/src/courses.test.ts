import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ensureCourse } from "./courses";
import { createDatabase } from "./database";
import { courses } from "./schema";

describe.skipIf(!process.env.DATABASE_URL)("ensureCourse (real Postgres)", () => {
  const database = createDatabase(process.env.DATABASE_URL ?? "");

  beforeAll(() => database.runMigrations());
  afterAll(() => database.close());
  beforeEach(() => database.db.execute(sql`truncate courses cascade`));

  it("creates the course once and leaves it unchanged afterwards", async () => {
    expect(await ensureCourse(database.db, "INF24B", "first-code")).toBe(true);
    expect(await ensureCourse(database.db, "INF24B", "second-code")).toBe(false);

    const rows = await database.db.select().from(courses);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "INF24B", joinCode: "first-code" });
  });

  it("does not create a second course with a join code already in use", async () => {
    await ensureCourse(database.db, "INF24A", "shared-code");
    expect(await ensureCourse(database.db, "INF24B", "shared-code")).toBe(false);
  });
});
