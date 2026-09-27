import argon2 from "argon2";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@free-site/shared";

// Each Argon2 run takes 64 MiB of memory by design. Running at most this many at once keeps a flood
// of login requests from exhausting the server's memory; the rest wait their turn.
const MAX_CONCURRENT_HASHES = 2;
let runningHashes = 0;
const waitingHashes: Array<() => void> = [];

/**
 * Runs an Argon2 operation once a slot is free.
 * @param {() => Promise<T>} operation
 */
export async function withHashSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (runningHashes < MAX_CONCURRENT_HASHES) runningHashes += 1;
  // A finished operation hands its slot straight to the next waiter, so the count never overshoots.
  else await new Promise<void>((resolve) => waitingHashes.push(resolve));
  try {
    return await operation();
  } finally {
    const next = waitingHashes.shift();
    if (next) next();
    else runningHashes -= 1;
  }
}

/** Number of Argon2 operations running right now, for tests. */
export function runningHashCount(): number {
  return runningHashes;
}

// Verified against when the email is unknown, so both paths cost the same time.
const dummyHashPromise = argon2.hash("dummy-password-for-timing", { type: argon2.argon2id });

/**
 * True if the password meets the length policy (no composition rules).
 * @param {string} password
 */
export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}

/**
 * Hashes a password with Argon2id.
 * @param {string} password
 */
export function hashPassword(password: string): Promise<string> {
  return withHashSlot(() => argon2.hash(password, { type: argon2.argon2id }));
}

/**
 * Checks a password against a stored hash; with no hash it checks a dummy and returns false.
 * @param {string | undefined} passwordHash
 * @param {string} password
 */
export async function verifyPassword(passwordHash: string | undefined, password: string): Promise<boolean> {
  const hash = passwordHash ?? (await dummyHashPromise);
  const matches = await withHashSlot(() => argon2.verify(hash, password));
  return passwordHash !== undefined && matches;
}
