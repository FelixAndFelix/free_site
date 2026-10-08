import { sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { AUDIT_CATEGORIES, USER_ROLES, VOTE_VALUES, type AuditAction, type Language } from "@free-site/shared";

export const userRole = pgEnum("user_role", USER_ROLES);
export const voteValue = pgEnum("vote_value", VOTE_VALUES);
export const auditCategory = pgEnum("audit_category", AUDIT_CATEGORIES);
export const emailCodePurpose = pgEnum("email_code_purpose", ["register", "reset"]);

// username is nullable only for accounts created before usernames existed; they choose one after login.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    username: text("username"),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("user"),
    language: text("language").$type<Language>().notNull().default("en"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_username_lower_unique").on(sql`lower(${table.username})`)],
);

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  joinCode: text("join_code").notNull().unique(),
});

export const courseMembers = pgTable(
  "course_members",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.userId] })],
);

// One active code per address and purpose: requesting a new one replaces the old one.
export const emailCodes = pgTable(
  "email_codes",
  {
    email: text("email").notNull(),
    purpose: emailCodePurpose("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.email, table.purpose] })],
);

// The id is the SHA-256 of the cookie token, so a database leak does not expose live sessions.
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// "Modul" in the planning documents; lectures and modules are the same entity.
export const modules = pgTable(
  "modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    semester: integer("semester").notNull(),
  },
  (table) => [index("modules_course_id_idx").on(table.courseId)],
);

// One vote per user and module, changed by upsert. Votes are linked to user_id and therefore
// not anonymous towards the operator (see the privacy notes in planning/Decisions.md).
// A withdrawn vote keeps its row with vote_value null, so updated_at still drives the change cooldown.
export const votes = pgTable(
  "votes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    value: voteValue("vote_value"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.moduleId] }), index("votes_module_id_idx").on(table.moduleId)],
);

// Append-only history of vote changes for the graphs over time. It stores no user id, so the
// history cannot be linked to a person and stays intact when an account is deleted.
// fromValue null = a new vote, toValue null = a withdrawn vote.
export const voteChanges = pgTable(
  "vote_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    fromValue: voteValue("from_value"),
    toValue: voteValue("to_value"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("vote_changes_module_id_changed_at_idx").on(table.moduleId, table.changedAt)],
);

// What admins changed ("audit") and who signed in or out of accounts ("access"). Users are linked with
// ON DELETE SET NULL, but email and ip are kept as written, so the log still shows who and from where
// until the retention time ends (see RETENTION_DAYS in audit/log.ts and the privacy page).
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    category: auditCategory("category").notNull(),
    action: text("action").$type<AuditAction>().notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    label: text("label"),
    // The email address the event is about: the account for access events, the affected user for
    // admin changes to a user, or the address that was typed for a failed login.
    email: text("email"),
    ip: text("ip"),
  },
  (table) => [
    index("audit_log_category_created_idx").on(table.category, table.createdAt),
    index("audit_log_actor_idx").on(table.actorUserId),
    index("audit_log_target_idx").on(table.targetUserId),
  ],
);
