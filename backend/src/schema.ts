import { sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { USER_ROLES, VOTE_VALUES } from "@free-site/shared";

export const userRole = pgEnum("user_role", USER_ROLES);
export const voteValue = pgEnum("vote_value", VOTE_VALUES);
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
export const votes = pgTable(
  "votes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    value: voteValue("vote_value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.moduleId] }), index("votes_module_id_idx").on(table.moduleId)],
);
