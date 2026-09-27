import { describe, expect, it } from "vitest";
import { createLoginThrottle, createWindowLimiter } from "./rateLimit";

/** A manually advanced clock for deterministic timing tests. */
function createClock() {
  let time = Date.parse("2026-01-01T00:00:00Z");
  return { now: () => new Date(time), advance: (ms: number) => (time += ms) };
}

describe("createWindowLimiter", () => {
  it("allows the limit per window, then blocks until the window passes", () => {
    const clock = createClock();
    const limiter = createWindowLimiter({ limit: 5, windowMs: 1000, now: clock.now });

    for (let hit = 0; hit < 5; hit++) expect(limiter.hit("ip")).toBe(true);
    expect(limiter.hit("ip")).toBe(false);
    expect(limiter.hit("other-ip")).toBe(true);

    clock.advance(1000);
    expect(limiter.hit("ip")).toBe(true);
  });
});

describe("createLoginThrottle", () => {
  it("allows four failures freely", () => {
    const clock = createClock();
    const throttle = createLoginThrottle(clock.now);

    for (let failure = 0; failure < 4; failure++) throttle.recordFailure("a@x.de");
    expect(throttle.isBlocked("a@x.de")).toBe(false);
  });

  it("blocks with a doubling delay from the fifth failure, capped at 15 minutes", () => {
    const clock = createClock();
    const throttle = createLoginThrottle(clock.now);
    for (let failure = 0; failure < 5; failure++) throttle.recordFailure("a@x.de");

    expect(throttle.isBlocked("a@x.de")).toBe(true);
    clock.advance(30_000);
    expect(throttle.isBlocked("a@x.de")).toBe(false);

    throttle.recordFailure("a@x.de");
    clock.advance(59_999);
    expect(throttle.isBlocked("a@x.de")).toBe(true);

    for (let failure = 0; failure < 10; failure++) throttle.recordFailure("a@x.de");
    clock.advance(15 * 60_000);
    expect(throttle.isBlocked("a@x.de")).toBe(false);
  });

  it("clears the failures on reset", () => {
    const clock = createClock();
    const throttle = createLoginThrottle(clock.now);
    for (let failure = 0; failure < 5; failure++) throttle.recordFailure("a@x.de");

    throttle.reset("a@x.de");
    expect(throttle.isBlocked("a@x.de")).toBe(false);
  });
});
