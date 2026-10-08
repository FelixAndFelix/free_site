import { and, desc, eq, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AuditAction, AuditCategory, AuditEntry, AuditResponse } from "@free-site/shared";
import type { Db } from "../database";
import { isUuid } from "../http";
import { auditLog, users } from "../schema";
import { normalizeIp } from "./ip";

/** How long entries are kept. Admin changes matter longer than sign-ins, which hold more personal data (emails, addresses). */
export const RETENTION_DAYS: Record<AuditCategory, number> = { audit: 365, access: 90 };

const PAGE_SIZE = 50;

export interface AuditEvent {
  category: AuditCategory;
  action: AuditAction;
  /** The user who did it, if there is one. */
  actorUserId?: string | null;
  /** The other user it concerned, if any. */
  targetUserId?: string | null;
  /** A course or module name, or the new role. */
  label?: string | null;
  /** The email address the event is about, as written. */
  email?: string | null;
  /** The client address of the request, as written. */
  ip?: string;
}

/**
 * The activity log: admin changes ("audit") and sign-ins and account events ("access").
 * Recording is best effort: a failure is logged and swallowed, so a problem with the log can never
 * stop someone from logging in or an admin from working.
 * @param {Db} db
 * @param {() => Date} [now]
 */
export function createAuditLog(db: Db, now: () => Date = () => new Date()) {
  /** Writes one entry. */
  async function record(event: AuditEvent): Promise<void> {
    try {
      await db.insert(auditLog).values({
        createdAt: now(),
        category: event.category,
        action: event.action,
        actorUserId: event.actorUserId ?? null,
        targetUserId: event.targetUserId ?? null,
        label: event.label ?? null,
        email: event.email ?? null,
        ip: normalizeIp(event.ip),
      });
    } catch (error) {
      console.error("audit log failed", error);
    }
  }

  /**
   * Lists one log, newest first, with the user names resolved. cursor is the nextCursor of the
   * previous page.
   * @param {{category: AuditCategory, cursor?: string}} options
   */
  async function list({ category, cursor }: { category: AuditCategory; cursor?: string }): Promise<AuditResponse | null> {
    const position = cursor === undefined ? null : parseCursor(cursor);
    if (cursor !== undefined && !position) return null;
    const actor = alias(users, "actor");
    const target = alias(users, "target");
    const rows = await db
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        category: auditLog.category,
        action: auditLog.action,
        actor: actor.username,
        actorEmail: actor.email,
        target: target.username,
        email: auditLog.email,
        label: auditLog.label,
        ip: auditLog.ip,
      })
      .from(auditLog)
      .leftJoin(actor, eq(actor.id, auditLog.actorUserId))
      .leftJoin(target, eq(target.id, auditLog.targetUserId))
      .where(
        and(
          eq(auditLog.category, category),
          position ? sql`(${auditLog.createdAt}, ${auditLog.id}) < (${position.createdAt}, ${position.id})` : undefined,
        ),
      )
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(PAGE_SIZE + 1);
    const page = rows.slice(0, PAGE_SIZE);
    const entries: AuditEntry[] = page.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
    const last = page.at(-1);
    return {
      entries,
      nextCursor: rows.length > PAGE_SIZE && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    };
  }

  return { record, list };
}

export type AuditLog = ReturnType<typeof createAuditLog>;

/**
 * Parses a cursor of the form "<iso time>|<uuid>", or returns null if it is not one.
 * @param {string} cursor
 */
function parseCursor(cursor: string): { createdAt: Date; id: string } | null {
  const [time, id, ...rest] = cursor.split("|");
  const createdAt = new Date(time ?? "");
  return rest.length === 0 && isUuid(id) && !Number.isNaN(createdAt.getTime()) ? { createdAt, id } : null;
}

/**
 * Deletes entries older than their category's retention time. Returns how many were deleted.
 * @param {Db} db
 * @param {Date} now
 */
export async function deleteExpiredAuditEntries(db: Db, now: Date): Promise<number> {
  let deleted = 0;
  for (const [category, days] of Object.entries(RETENTION_DAYS) as [AuditCategory, number][]) {
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const removed = await db
      .delete(auditLog)
      .where(and(eq(auditLog.category, category), lt(auditLog.createdAt, cutoff)))
      .returning({ id: auditLog.id });
    deleted += removed.length;
  }
  return deleted;
}
