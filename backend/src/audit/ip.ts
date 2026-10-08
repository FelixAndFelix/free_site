/**
 * Returns the client address as it should be logged: unchanged, except that an IPv4 address that
 * arrives as IPv6-mapped (::ffff:203.0.113.57, as Node reports IPv4 clients of a dual-stack socket)
 * is written as the plain IPv4 address it is. Returns null when there is no address.
 * @param {string | undefined} ip
 */
export function normalizeIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return ip.toLowerCase().startsWith("::ffff:") && ip.includes(".") ? ip.slice(7) : ip;
}
