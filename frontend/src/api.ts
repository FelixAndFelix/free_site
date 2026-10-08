import type { ApiErrorCode } from "@free-site/shared";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorCode; retryAt?: string };

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
