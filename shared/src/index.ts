/** Response body of GET /api/health. */
export interface HealthResponse {
  status: "ok" | "degraded";
  database: boolean;
}

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;

/** The logged-in user as returned by the auth endpoints. */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/** Body of POST /api/auth/register/start. */
export interface RegisterStartRequest {
  email: string;
  courseCode: string;
}

/** Body of POST /api/auth/register/complete. */
export interface RegisterCompleteRequest {
  email: string;
  courseCode: string;
  code: string;
  password: string;
}

/** Body of POST /api/auth/login. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Body of POST /api/auth/reset/start. */
export interface ResetStartRequest {
  email: string;
}

/** Body of POST /api/auth/reset/complete. */
export interface ResetCompleteRequest {
  email: string;
  code: string;
  password: string;
}

/** Response body of the endpoints that return the current user. */
export interface UserResponse {
  user: AuthUser;
}

export type ApiErrorCode =
  | "invalid_request"
  | "invalid_email"
  | "email_domain_not_allowed"
  | "invalid_course_code"
  | "invalid_code"
  | "invalid_password"
  | "invalid_credentials"
  | "unauthenticated"
  | "rate_limited"
  | "internal_error";

/** Body of every error response. */
export interface ApiError {
  error: ApiErrorCode;
}
