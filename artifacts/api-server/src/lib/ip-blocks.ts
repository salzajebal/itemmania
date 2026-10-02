import { BlockList, isIP } from "node:net";
import type { Request, Response, NextFunction } from "express";
import { db, blockedIpsTable } from "@workspace/db";

// Nginx overwrites X-Real-IP with its peer address. Trust CF-Connecting-IP
// only when that peer is actually a Cloudflare edge, not a direct-origin caller.
// Ranges: https://www.cloudflare.com/ips/ (checked 2026-09-29).
const cloudflare = new BlockList();
for (const cidr of [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22",
  "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
  "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22",
  "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32",
  "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29",
  "2c0f:f248::/32",
]) {
  const [address, bits] = cidr.split("/");
  cloudflare.addSubnet(address, Number(bits), isIP(address) === 4 ? "ipv4" : "ipv6");
}

/** Canonicalize an individual IP. CIDR ranges and hostnames are not supported. */
export function normalizeIp(value: string): string | null {
  const raw = value.trim();
  const family = isIP(raw);
  if (!family) return null;
  if (family === 4) return raw;
  if (raw.toLowerCase().startsWith("::ffff:") && isIP(raw.slice(7)) === 4) {
    return raw.slice(7);
  }
  const canonical = new URL(`http://[${raw}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(canonical);
  if (mapped) {
    const a = parseInt(mapped[1], 16);
    const b = parseInt(mapped[2], 16);
    return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
  }
  return canonical;
}

export function clientIp(req: Request): string | null {
  const peer = normalizeIp(req.socket.remoteAddress || "");
  const nginxPeer = req.get("x-real-ip");
  if ((peer === "127.0.0.1" || peer === "::1") && nginxPeer) {
    const origin = normalizeIp(nginxPeer);
    if (origin) {
      const fromCloudflare = cloudflare.check(origin, isIP(origin) === 4 ? "ipv4" : "ipv6");
      const forwarded = req.get("cf-connecting-ip");
      if (fromCloudflare && forwarded) return normalizeIp(forwarded) || origin;
      return origin;
    }
  }
  // A direct connection must never use Express's globally trusted X-Forwarded-For.
  return peer;
}

let blocked = new Set<string>();
let refreshedAt = 0;
let revision = 0;
let loading: Promise<void> | null = null;
const CACHE_MS = 3000;

async function refreshBlocks(): Promise<void> {
  if (Date.now() - refreshedAt < CACHE_MS) return;
  if (!loading) {
    const currentRevision = revision;
    loading = db.select({ ip: blockedIpsTable.ip }).from(blockedIpsTable)
      .then((rows) => {
        if (revision === currentRevision) {
          blocked = new Set(rows.map((row) => row.ip));
          refreshedAt = Date.now();
        }
      })
      .finally(() => { loading = null; });
  }
  await loading;
}

export function updateBlockedIp(ip: string, isBlocked: boolean): void {
  revision++;
  blocked = new Set(blocked);
  if (isBlocked) blocked.add(ip);
  else blocked.delete(ip);
  refreshedAt = Date.now();
}

export async function rejectBlockedIp(req: Request, res: Response, next: NextFunction): Promise<void> {
  const path = req.path;
  // Always keep the admin login and management paths reachable for recovery.
  if (path === "/banana777" || path.startsWith("/banana777/") ||
      path === "/api/admin" || path.startsWith("/api/admin/") ||
      req.session?.adminRole === "admin" && !!req.session.adminId) {
    next();
    return;
  }

  try {
    await refreshBlocks();
    const ip = clientIp(req);
    if (ip && blocked.has(ip)) {
      res.set("Cache-Control", "no-store");
      res.status(403).type("text/plain").send("접근이 차단된 IP 주소입니다.");
      return;
    }
    next();
  } catch (error) {
    req.log.error({ err: error }, "IP 차단 목록 조회 실패");
    res.status(503).json({ error: "접속 권한을 확인할 수 없습니다." });
  }
}