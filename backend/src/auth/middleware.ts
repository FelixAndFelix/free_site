import type { NextFunction, Request, Response } from "express";
import type { ApiError, AuthUser, UserRole } from "@free-site/shared";
import type { Db } from "../database";
import { SESSION_COOKIE, findSessionUser } from "./sessions";

/**
 * Reads the session cookie and returns its user, or null.
 * @param {Db} db
 * @param {Request} request
 * @param {Date} now
 */
export async function readSessionUser(db: Db, request: Request, now: Date): Promise<AuthUser | null> {
  const token: unknown = request.cookies?.[SESSION_COOKIE];
  return typeof token === "string" ? findSessionUser(db, token, now) : null;
}

/**
 * Middleware that lets only logged-in users with the given role through
 * and stores the user in response.locals.user.
 * @param {{db: Db, role: UserRole, now: () => Date}} options
 */
export function requireRole({ db, role, now }: { db: Db; role: UserRole; now: () => Date }) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const user = await readSessionUser(db, request, now());
    if (!user) return response.status(401).json({ error: "unauthenticated" } satisfies ApiError);
    if (role === "admin" && user.role !== "admin") {
      return response.status(403).json({ error: "forbidden" } satisfies ApiError);
    }
    response.locals.user = user;
    next();
  };
}
