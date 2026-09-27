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
  /** Shown instead of the email; null only for accounts that have not chosen one yet. */
  username: string | null;
  role: UserRole;
}

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
// Letters (including umlauts), digits, dot, underscore and hyphen.
export const USERNAME_PATTERN = new RegExp(`^[\\p{L}\\p{N}._-]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}$`, "u");

/** Body of POST /api/auth/register/start. */
export interface RegisterStartRequest {
  email: string;
  username: string;
  courseCode: string;
  /** Only for the first admin; must match ADMIN_SETUP_CODE while no admin exists. */
  adminSetupCode?: string;
}

/** Body of POST /api/auth/register/complete. */
export interface RegisterCompleteRequest {
  email: string;
  username: string;
  courseCode: string;
  code: string;
  password: string;
  adminSetupCode?: string;
}

/** Body of PUT /api/auth/username. */
export interface SetUsernameRequest {
  username: string;
}

/** Body of POST /api/auth/claim-admin. */
export interface ClaimAdminRequest {
  adminSetupCode: string;
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
  | "invalid_setup_code"
  | "invalid_username"
  | "username_taken"
  | "forbidden"
  | "not_found"
  | "course_exists"
  | "cannot_change_own_role"
  | "internal_error";

/** Body of every error response. */
export interface ApiError {
  error: ApiErrorCode;
}

export const MAX_SEMESTER = 6;
export const NAME_MAX_LENGTH = 100;

/** A course as shown to admins, including its secret join code. */
export interface AdminCourse {
  id: string;
  name: string;
  joinCode: string;
  memberCount: number;
  moduleCount: number;
}

/** A module (lecture) of a course. */
export interface Module {
  id: string;
  courseId: string;
  name: string;
  semester: number;
}

/** A user as listed for admins. */
export interface AdminUserEntry {
  id: string;
  email: string;
  username: string | null;
  role: UserRole;
  courseName: string | null;
}

/** Body of POST /api/admin/courses. */
export interface CreateCourseRequest {
  name: string;
}

/** Body of POST /api/admin/courses/:courseId/modules. */
export interface CreateModuleRequest {
  name: string;
  semester: number;
}

/** Body of PATCH /api/admin/users/:userId. */
export interface UpdateUserRoleRequest {
  role: UserRole;
}

export interface CoursesResponse {
  courses: AdminCourse[];
}

export interface CourseResponse {
  course: AdminCourse;
}

export interface ModulesResponse {
  modules: Module[];
}

export interface ModuleResponse {
  module: Module;
}

export interface UsersResponse {
  users: AdminUserEntry[];
}

export interface UserEntryResponse {
  user: AdminUserEntry;
}
