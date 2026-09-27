import type { ApiErrorCode } from "@free-site/shared";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorCode; retryAt?: string };

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  invalid_request: "Something about the request was wrong. Please try again.",
  invalid_email: "Please enter a valid email address.",
  email_domain_not_allowed: "Please use your DHBW email address.",
  invalid_course_code: "This course code does not exist.",
  invalid_code: "The code is wrong or has expired. Request a new one.",
  invalid_password: "The password needs at least 10 characters.",
  invalid_credentials: "Email or password is wrong.",
  unauthenticated: "Please log in.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  invalid_setup_code: "The admin setup code is wrong or no longer valid.",
  invalid_username: `A username needs 3 to 20 letters, digits, ".", "_" or "-".`,
  username_taken: "This username is already taken.",
  forbidden: "Only admins can do this.",
  not_found: "This no longer exists. Reload the page.",
  course_exists: "A course with this name already exists.",
  cannot_change_own_role: "You cannot change your own role.",
  course_not_empty: "This course still has members. Move or remove them first.",
  vote_cooldown: "You changed this vote recently. Please wait a moment.",
  internal_error: "Something went wrong on our side. Please try again later.",
};

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: object;
}

/**
 * Sends a JSON request to the backend and never throws: network errors become internal_error.
 * @param {string} path
 * @param {RequestOptions} [options] the method defaults to POST with a body, GET without
 */
export async function apiRequest<T>(path: string, { method, body }: RequestOptions = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: method ?? (body ? "POST" : "GET"),
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = response.status === 204 ? {} : await response.json();
    if (response.ok) return { ok: true, data: data as T };
    return { ok: false, error: data.error ?? "internal_error", retryAt: data.retryAt };
  } catch {
    return { ok: false, error: "internal_error" };
  }
}

/**
 * Maps an API error code to a message for the user.
 * @param {ApiErrorCode} error
 */
export function errorMessage(error: ApiErrorCode): string {
  return ERROR_MESSAGES[error] ?? ERROR_MESSAGES.internal_error;
}
