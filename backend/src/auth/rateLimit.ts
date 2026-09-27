// In-memory state is fine for a single backend instance; a restart only resets the counters.
const MAX_TRACKED_KEYS = 10_000;

/**
 * Allows at most `limit` hits per key within a fixed window.
 * @param {{limit: number, windowMs: number, now: () => Date}} options
 */
export function createWindowLimiter({ limit, windowMs, now }: { limit: number; windowMs: number; now: () => Date }) {
  const windows = new Map<string, { count: number; startedAt: number }>();

  /** Records a hit for the key and returns false once the key is over the limit. */
  function hit(key: string): boolean {
    const time = now().getTime();
    if (windows.size > MAX_TRACKED_KEYS) pruneWhere(windows, (entry) => time - entry.startedAt >= windowMs);

    const entry = windows.get(key);
    if (!entry || time - entry.startedAt >= windowMs) {
      windows.set(key, { count: 1, startedAt: time });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  }

  /** True if the key has used up its limit in the current window, without recording a hit. */
  function isLimited(key: string): boolean {
    const entry = windows.get(key);
    return entry !== undefined && now().getTime() - entry.startedAt < windowMs && entry.count >= limit;
  }

  return { hit, isLimited };
}

const FREE_FAILURES = 5;
const BASE_DELAY_MS = 30 * 1000;
const MAX_DELAY_MS = 15 * 60 * 1000;
const FAILURE_MEMORY_MS = 24 * 60 * 60 * 1000;

/**
 * Tracks failed logins per email: after 5 failures each further failure blocks the
 * email for a doubling delay, capped at 15 minutes. There is no permanent lockout.
 * @param {() => Date} now
 */
export function createLoginThrottle(now: () => Date) {
  const failures = new Map<string, { count: number; blockedUntil: number; lastFailureAt: number }>();

  /** Drops the state of emails whose last failure is older than a day. */
  function forgetStale(time: number) {
    pruneWhere(failures, (entry) => time - entry.lastFailureAt >= FAILURE_MEMORY_MS);
  }

  /** True if a login attempt for the email is currently blocked. */
  function isBlocked(email: string): boolean {
    const entry = failures.get(email);
    return entry !== undefined && now().getTime() < entry.blockedUntil;
  }

  /** Counts a failed attempt and extends the block once the free failures are used up. */
  function recordFailure(email: string) {
    const time = now().getTime();
    if (failures.size > MAX_TRACKED_KEYS) forgetStale(time);

    const previous = failures.get(email);
    const count = previous && time - previous.lastFailureAt < FAILURE_MEMORY_MS ? previous.count + 1 : 1;
    const delay = count < FREE_FAILURES ? 0 : Math.min(BASE_DELAY_MS * 2 ** (count - FREE_FAILURES), MAX_DELAY_MS);
    failures.set(email, { count, blockedUntil: time + delay, lastFailureAt: time });
  }

  /** Clears the failures of an email after a successful login or password reset. */
  function reset(email: string) {
    failures.delete(email);
  }

  return { isBlocked, recordFailure, reset };
}

/**
 * Deletes every map entry matching the predicate.
 * @param {Map<string, T>} map
 * @param {(entry: T) => boolean} isStale
 */
function pruneWhere<T>(map: Map<string, T>, isStale: (entry: T) => boolean) {
  for (const [key, entry] of map) if (isStale(entry)) map.delete(key);
}
