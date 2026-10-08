import { describe, expect, it } from "vitest";
import { normalizeIp } from "./ip";

describe("normalizeIp", () => {
  it("keeps addresses unchanged", () => {
    expect(normalizeIp("203.0.113.57")).toBe("203.0.113.57");
    expect(normalizeIp("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3:8d3:1319:8a2e:370:7348");
    expect(normalizeIp("::1")).toBe("::1");
  });

  it("writes an IPv6-mapped IPv4 address as the IPv4 address it is", () => {
    expect(normalizeIp("::ffff:203.0.113.57")).toBe("203.0.113.57");
    expect(normalizeIp("::FFFF:10.1.2.3")).toBe("10.1.2.3");
  });

  it("returns null when there is no address", () => {
    expect(normalizeIp(undefined)).toBeNull();
    expect(normalizeIp("")).toBeNull();
  });
});
