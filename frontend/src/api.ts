import type { ApiErrorCode } from "@free-site/shared";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorCode };

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
  internal_error: "Something went wrong on our side. Please try again later.",
};

/**
 * Sends a JSON request to the backend and never throws: network errors become internal_error.
 * @param {string} path
 * @param {object} [body] sent as a POST when given, otherwise the request is a GET
 */
export async function apiRequest<T>(path: string, body?: object): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = response.status === 204 ? {} : await response.json();
    return response.ok ? { ok: true, data: data as T } : { ok: false, error: data.error ?? "internal_error" };
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
