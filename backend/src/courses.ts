import { eq } from "drizzle-orm";
import { randomInt } from "node:crypto";
import type { Db } from "./database";
import { courses } from "./schema";

// No 0/O or 1/I, so codes read aloud or copied from a slide are not mistyped.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_RANDOM_LENGTH = 8;

/**
 * Creates a join code like INF24B-7KQ2XMPA: a readable prefix from the course name
 * plus 40 random bits, which the per-IP limit makes infeasible to guess.
 * @param {string} courseName
 */
export function generateJoinCode(courseName: string): string {
  const prefix = courseName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "COURSE";
  let random = "";
  for (let index = 0; index < JOIN_CODE_RANDOM_LENGTH; index++) {
    random += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return `${prefix}-${random}`;
}

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
