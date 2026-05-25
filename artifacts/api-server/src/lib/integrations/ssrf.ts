import { promises as dns } from "node:dns";
import net from "node:net";

/**
 * SSRF guard for admin-supplied URLs (Upstash REST URL, Sentry DSN host,
 * BetterStack ingest host, etc.). Even though the integration test
 * endpoint is gated behind super-admin auth, we must not let an admin —
 * compromised or curious — turn the API server into a probe of internal
 * services (Postgres, Redis, cloud metadata IPs, the bots themselves).
 *
 * Rules:
 *   - http://, https:// only. No file://, gopher://, ftp://, javascript:.
 *   - Hostname must resolve to at least one IP, and **every** resolved IP
 *     must be a routable public unicast address. A single private/loopback
 *     IP is enough to reject (DNS rebinding defence).
 *   - Cloud metadata IPs (169.254.169.254, fd00:ec2::254) explicitly blocked.
 */
const BLOCKED_PRIVATE_V4 = [
  // 10.0.0.0/8
  { net: [10, 0, 0, 0], mask: 8 },
  // 172.16.0.0/12
  { net: [172, 16, 0, 0], mask: 12 },
  // 192.168.0.0/16
  { net: [192, 168, 0, 0], mask: 16 },
  // 127.0.0.0/8 loopback
  { net: [127, 0, 0, 0], mask: 8 },
  // 169.254.0.0/16 link-local (includes 169.254.169.254 cloud metadata)
  { net: [169, 254, 0, 0], mask: 16 },
  // 0.0.0.0/8 "this network"
  { net: [0, 0, 0, 0], mask: 8 },
  // 100.64.0.0/10 CGNAT
  { net: [100, 64, 0, 0], mask: 10 },
];

function ipv4InCidr(ip: string, net: number[], maskBits: number): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const ipInt = (parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!;
  const netInt = (net[0]! << 24) | (net[1]! << 16) | (net[2]! << 8) | net[3]!;
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return ((ipInt >>> 0) & mask) === ((netInt >>> 0) & mask);
}

function isBlockedV4(ip: string): boolean {
  return BLOCKED_PRIVATE_V4.some((r) => ipv4InCidr(ip, r.net, r.mask));
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // ::1 loopback, fc00::/7 unique-local, fe80::/10 link-local
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
  // IPv6 cloud metadata (AWS fd00:ec2::254 falls under fc/fd above)
  return false;
}

export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`forbidden_protocol:${url.protocol}`);
  }
  const host = url.hostname;
  if (!host) throw new Error("missing_host");

  // If host is a literal IP, check directly without DNS.
  if (net.isIP(host)) {
    if (net.isIPv4(host) && isBlockedV4(host)) {
      throw new Error(`blocked_private_ip:${host}`);
    }
    if (net.isIPv6(host) && isBlockedV6(host)) {
      throw new Error(`blocked_private_ip:${host}`);
    }
    return url;
  }

  // Otherwise resolve and check every returned address (DNS rebinding defence).
  let addrs: { address: string; family: number }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch (e) {
    throw new Error(`dns_failed:${e instanceof Error ? e.message : "unknown"}`);
  }
  if (addrs.length === 0) throw new Error("dns_empty");
  for (const a of addrs) {
    if (a.family === 4 && isBlockedV4(a.address)) {
      throw new Error(`blocked_private_ip:${a.address}`);
    }
    if (a.family === 6 && isBlockedV6(a.address)) {
      throw new Error(`blocked_private_ip:${a.address}`);
    }
  }
  return url;
}
