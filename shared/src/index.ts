/** Response body of GET /api/health. */
export interface HealthResponse {
  status: "ok" | "degraded";
  database: boolean;
}

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;

/** Interface languages. The privacy page stays English only. */
export const LANGUAGES = ["en", "de"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

/**
 * Narrows a value to a supported language.
 * @param {unknown} value
 */
export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/** The logged-in user as returned by the auth endpoints. */
export interface AuthUser {
  id: string;
  email: string;
  /** Shown instead of the email; null only for accounts that have not chosen one yet. */
  username: string | null;
  role: UserRole;
  /** The interface language chosen for this account; also the language of its emails. */
  language: Language;
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
  /** The language the visitor reads the page in; the code mail is written in it. */
  language?: Language;
}

/** Body of POST /api/auth/register/complete. */
export interface RegisterCompleteRequest {
  email: string;
  username: string;
  courseCode: string;
  code: string;
  password: string;
  adminSetupCode?: string;
  /** Becomes the language of the new account. */
  language?: Language;
}

/** Body of PUT /api/auth/language. */
export interface SetLanguageRequest {
  language: Language;
}

/** Body of PUT /api/auth/username. */
export interface SetUsernameRequest {
  username: string;
}

/** Body of DELETE /api/auth/account: the password confirms that the owner is deleting it. */
export interface DeleteAccountRequest {
  password: string;
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
  /** The language the visitor reads the page in; the code mail is written in it. */
  language?: Language;
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
  | "course_not_empty"
  | "vote_cooldown"
  | "last_admin"
  | "already_in_course"
  | "internal_error";

/** Body of every error response. */
export interface ApiError {
  error: ApiErrorCode;
  /** Only with vote_cooldown: ISO time from which the vote can be changed again. */
  retryAt?: string;
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
  courseId: string | null;
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

/** Body of PATCH /api/admin/modules/:moduleId; at least one field. */
export interface UpdateModuleRequest {
  name?: string;
  semester?: number;
}

/** Body of PATCH /api/admin/courses/:courseId. */
export interface RenameCourseRequest {
  name: string;
}

/** Body of PUT /api/admin/users/:userId/course; null removes the user from their course. */
export interface SetUserCourseRequest {
  courseId: string | null;
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

/** Vote values in scale order; the UI shows them as green, yellow and red. */
export const VOTE_VALUES = ["free", "possible", "impossible"] as const;
export type VoteValue = (typeof VOTE_VALUES)[number];

export type VoteCounts = Record<VoteValue, number>;

/** A user can change or withdraw their vote on a module at most once per this many minutes. */
export const VOTE_COOLDOWN_MINUTES = 15;

/** A module in the voting overview: vote counts of the course plus the current user's vote. */
export interface ModuleOverview {
  id: string;
  name: string;
  semester: number;
  counts: VoteCounts;
  myVote: VoteValue | null;
  /** ISO time from which the user may change their vote again; null if they may change it now. */
  canChangeAt: string | null;
}

/** Response body of GET /api/overview; course is null for users who are in no course. */
export interface OverviewResponse {
  course: { id: string; name: string } | null;
  modules: ModuleOverview[];
}

/** Body of PUT /api/modules/:moduleId/vote. */
export interface VoteRequest {
  value: VoteValue;
}

/** Response body of the vote endpoints. */
export interface ModuleOverviewResponse {
  module: ModuleOverview;
}

/** Vote counts at the end of one calendar day (Europe/Berlin), YYYY-MM-DD. */
export interface VoteHistoryDay {
  day: string;
  counts: VoteCounts;
}

/** Response body of GET /api/modules/:moduleId: the module and its daily vote history. */
export interface ModuleDetailResponse {
  module: ModuleOverview;
  history: VoteHistoryDay[];
}

/**
 * Events pushed over GET /api/events to everyone in a course (server-sent events).
 * They carry course-wide totals only, never who voted what.
 * - module-votes: a vote on a module changed; its new counts.
 * - modules-changed: an admin added or deleted modules of the course; reload the module list.
 */
export type CourseEvent =
  | { type: "module-votes"; moduleId: string; counts: VoteCounts }
  | { type: "modules-changed" };

/**
 * Response body of GET /api/join/:code, the public look-up behind an invite link.
 * membership is only present for logged-in users: "none" (no course yet), "same" (already a
 * member) or "other" (in a different course; currentCourseName says which).
 */
export interface JoinInfoResponse {
  course: { name: string };
  membership?: "none" | "same" | "other";
  currentCourseName?: string;
}

/** Body of POST /api/join/:code; confirmSwitch is required to leave another course. */
export interface JoinRequest {
  confirmSwitch?: boolean;
}

/** Response body of POST /api/join/:code: the course the user is now in. */
export interface JoinResponse {
  course: { id: string; name: string };
}

/**
 * Two logs, kept apart because they are kept for different times and answer different questions:
 * "audit" records what admins changed, "access" records who signed in or out of the app and how
 * accounts were created, recovered or deleted.
 */
export const AUDIT_CATEGORIES = ["audit", "access"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_ACTIONS = [
  // audit: admin changes
  "course.created",
  "course.renamed",
  "course.deleted",
  "course.join_code_rotated",
  "module.created",
  "module.updated",
  "module.deleted",
  "user.role_changed",
  "user.course_changed",
  // access: sign-ins and accounts
  "account.registered",
  "login.succeeded",
  "login.failed",
  "password_reset.requested",
  "password_reset.completed",
  "admin.claimed",
  "account.deleted",
  "course.joined",
  "course.switched",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Which actions belong to which log; the filter by event offers the actions of the log being viewed. */
export const AUDIT_ACTIONS_BY_CATEGORY: Record<AuditCategory, readonly AuditAction[]> = {
  audit: [
    "course.created",
    "course.renamed",
    "course.deleted",
    "course.join_code_rotated",
    "module.created",
    "module.updated",
    "module.deleted",
    "user.role_changed",
    "user.course_changed",
  ],
  access: [
    "account.registered",
    "login.succeeded",
    "login.failed",
    "password_reset.requested",
    "password_reset.completed",
    "admin.claimed",
    "account.deleted",
    "course.joined",
    "course.switched",
  ],
};

/** Time ranges the log can be limited to, counted back from now: 24 hours, 7 days, 30 days. */
export const AUDIT_RANGES = ["24h", "7d", "30d"] as const;
export type AuditRange = (typeof AUDIT_RANGES)[number];

/**
 * Narrows a value to an audit action.
 * @param {unknown} value
 */
export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

/**
 * Narrows a value to an audit time range.
 * @param {unknown} value
 */
export function isAuditRange(value: unknown): value is AuditRange {
  return typeof value === "string" && (AUDIT_RANGES as readonly string[]).includes(value);
}

/** Longest search text the log accepts. */
export const AUDIT_SEARCH_MAX_LENGTH = 100;

/** One entry of the activity log as shown to admins. */
export interface AuditEntry {
  id: string;
  createdAt: string;
  category: AuditCategory;
  action: AuditAction;
  /** Who did it; null if unknown or if that account has been deleted since. */
  actor: string | null;
  /** The current email address of that account. */
  actorEmail: string | null;
  /** Whom it concerned (another user); null if none or deleted since. */
  target: string | null;
  /** The email address the event is about, as it was at the time (also for failed logins of unknown addresses). */
  email: string | null;
  /** What it concerned that is not a user: a course or module name, or the new role. */
  label: string | null;
  /** The address the request came from. */
  ip: string | null;
}

/** Response body of GET /api/admin/audit: newest first, nextCursor continues with older entries. */
export interface AuditResponse {
  entries: AuditEntry[];
  nextCursor: string | null;
}
