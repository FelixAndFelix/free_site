import argon2 from "argon2";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@free-site/shared";

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
  return argon2.hash(password, { type: argon2.argon2id });
}

/**
 * Checks a password against a stored hash; with no hash it checks a dummy and returns false.
 * @param {string | undefined} passwordHash
 * @param {string} password
 */
export async function verifyPassword(passwordHash: string | undefined, password: string): Promise<boolean> {
  const matches = await argon2.verify(passwordHash ?? (await dummyHashPromise), password);
  return passwordHash !== undefined && matches;
}
