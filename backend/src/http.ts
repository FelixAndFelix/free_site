import type { Request, Response } from "express";
import type { ApiError, ApiErrorCode } from "@free-site/shared";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sends a JSON error body with the given status.
 * @param {Response} response
 * @param {number} status
 * @param {ApiErrorCode} error
 */
export function sendError(response: Response, status: number, error: ApiErrorCode) {
  const body: ApiError = { error };
  response.status(status).json(body);
}

/**
 * Returns the request body as a plain object, or an empty one if it is not an object.
 * @param {Request} request
 */
export function readBody(request: Request): Record<string, unknown> {
  const body: unknown = request.body;
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

/**
 * Returns the named string fields of the request body, or null if any is missing.
 * @param {Request} request
 * @param {string[]} keys
 */
export function readFields<K extends string>(request: Request, keys: K[]): Record<K, string> | null {
  const fields = readBody(request);
  return keys.every((key) => typeof fields[key] === "string") ? (fields as Record<K, string>) : null;
}

/**
 * True if the value is a UUID, so route ids can be checked before they reach Postgres.
 * @param {string | undefined} value
 */
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}
