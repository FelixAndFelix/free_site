import { eq } from "drizzle-orm";
import type { Db } from "./database";
import { courses } from "./schema";

/**
 * Creates a course unless one with this name or join code already exists.
 * Returns true if the course was created.
 * @param {Db} db
 * @param {string} name
 * @param {string} joinCode
 */
export async function ensureCourse(db: Db, name: string, joinCode: string): Promise<boolean> {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.name, name));
  if (existing) return false;
  const created = await db.insert(courses).values({ name, joinCode }).onConflictDoNothing().returning();
  return created.length === 1;
}
