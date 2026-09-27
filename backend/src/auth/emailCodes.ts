import { and, eq } from "drizzle-orm";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { Db } from "../database";
import { emailCodes } from "../schema";

export type EmailCodePurpose = "register" | "reset";

const CODE_VALIDITY_MS = 10 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Hashes a code bound to its address and purpose, so a hash cannot be replayed elsewhere.
 * @param {string} email
 * @param {EmailCodePurpose} purpose
 * @param {string} code
 */
function hashCode(email: string, purpose: EmailCodePurpose, code: string): string {
  return createHash("sha256").update(`${purpose}:${email}:${code}`).digest("hex");
}

/**
 * Creates a fresh 6-digit code, replacing any older one for the address and purpose.
 * Returns null if the last code was issued less than 60 seconds ago.
 * @param {Db} db
 * @param {string} email
 * @param {EmailCodePurpose} purpose
 * @param {Date} now
 */
export async function issueEmailCode(db: Db, email: string, purpose: EmailCodePurpose, now: Date): Promise<string | null> {
  const [existing] = await db
    .select({ createdAt: emailCodes.createdAt })
    .from(emailCodes)
    .where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose)));
  if (existing && now.getTime() - existing.createdAt.getTime() < RESEND_INTERVAL_MS) return null;

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const values = {
    codeHash: hashCode(email, purpose, code),
    expiresAt: new Date(now.getTime() + CODE_VALIDITY_MS),
    attempts: 0,
    createdAt: now,
  };
  await db
    .insert(emailCodes)
    .values({ email, purpose, ...values })
    .onConflictDoUpdate({ target: [emailCodes.email, emailCodes.purpose], set: values });
  return code;
}

/**
 * Checks a code and consumes it on success. A wrong guess counts as an attempt;
 * the fifth wrong guess deletes the code.
 * @param {Db} db
 * @param {string} email
 * @param {EmailCodePurpose} purpose
 * @param {string} code
 * @param {Date} now
 */
export async function consumeEmailCode(
  db: Db,
  email: string,
  purpose: EmailCodePurpose,
  code: string,
  now: Date,
): Promise<boolean> {
  const matchesRow = and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose));
  const [row] = await db.select().from(emailCodes).where(matchesRow);
  if (!row || row.expiresAt <= now) return false;

  const expected = Buffer.from(row.codeHash, "hex");
  const actual = Buffer.from(hashCode(email, purpose, code), "hex");
  if (timingSafeEqual(expected, actual)) {
    // The conditional delete makes the code single-use even under concurrent requests.
    const deleted = await db
      .delete(emailCodes)
      .where(and(matchesRow, eq(emailCodes.codeHash, row.codeHash)))
      .returning();
    return deleted.length === 1;
  }

  if (row.attempts + 1 >= MAX_ATTEMPTS) {
    await db.delete(emailCodes).where(matchesRow);
  } else {
    await db.update(emailCodes).set({ attempts: row.attempts + 1 }).where(matchesRow);
  }
  return false;
}
